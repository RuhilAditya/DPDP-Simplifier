"""RAG chain: retrieve DPDP clauses -> Phi-3-mini answers + plain-language rewrite.

Guarantees that do not depend on the model behaving:
  * original_clause is copied from the index, never generated, so it is always verbatim.
  * cited sections are limited to clauses that were actually retrieved.
  * if the best retrieval score is under SIM_THRESHOLD, the model is never called and the
    fixed fallback message is returned (out-of-scope questions).
  * if the model says the context does not answer the question, the same fallback is used.
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from functools import lru_cache

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate

from src import config

SECTION_REF = re.compile(r"\bsection\s+(\d{1,2})((?:\s*\(\s*\w{1,3}\s*\))*)", re.I)

ANSWER_SYSTEM = """You explain India's Digital Personal Data Protection Act, 2023 to ordinary people.
Use ONLY the numbered clauses in CONTEXT. Never use outside knowledge.

Rules:
- Keep the legal meaning exactly. Keep every condition, exception and time limit.
- Keep "shall" as must, "shall not" as must not, "may" as may. Never turn "may" into "must".
- If the clause says "as may be prescribed", say the details will be set by government rules.
- Never add details the clause does not state (no deadlines, amounts or steps it does not mention).
- Cite only the one or two clauses that actually contain the answer, not every clause shown.
- If CONTEXT does not answer the question, set "in_scope" to false and leave the other fields empty.
- Do not give legal advice.

Reply with JSON only, exactly these keys:
{{"in_scope": true or false,
  "answer": "direct answer to the question in 1-3 short sentences",
  "plain_language": "the relevant clause rewritten in plain English, short sentences, no jargon",
  "sections": ["the citation labels you used, copied exactly, e.g. Section 8(6)"]}}"""

ANSWER_HUMAN = """CONTEXT:
{context}

QUESTION: {question}"""

SIMPLIFY_SYSTEM = """You rewrite one clause of India's Digital Personal Data Protection Act, 2023 in plain English.
Rules:
- Keep the legal meaning exactly. Keep every condition, exception, actor and time limit.
- "shall" means must, "shall not" means must not, "may" means may. Never change these.
- Explain defined terms simply (Data Fiduciary = the organisation that decides how your data is used;
  Data Principal = the person the data is about; Board = Data Protection Board of India).
- If it says "as may be prescribed", say the details will be set by government rules.
- Use short sentences or a short bulleted list. Do not add facts that are not in the clause.

Reply with JSON only: {{"plain_language": "...", "key_points": ["...", "..."]}}"""

SIMPLIFY_HUMAN = """{citation} - {title}
{text}"""


@dataclass
class Retrieved:
    citation: str
    title: str
    text: str
    score: float
    chunk_id: str
    section: str


@dataclass
class Answer:
    question: str
    answer: str
    plain_language: str
    original_clause: str
    sections: list[str]
    disclaimer: str = config.DISCLAIMER
    fallback: bool = False
    fallback_reason: str | None = None
    retrieved: list[dict] = field(default_factory=list)
    latency_s: float = 0.0


@lru_cache(maxsize=1)
def _store():
    from langchain_community.vectorstores import FAISS
    from src.embeddings import get_embeddings

    if not (config.INDEX_DIR / "index.faiss").exists():
        raise RuntimeError("FAISS index missing. Run: python -m src.ingest")
    return FAISS.load_local(str(config.INDEX_DIR), get_embeddings(),
                            allow_dangerous_deserialization=True)  # our own local file


@lru_cache(maxsize=1)
def _chunks() -> dict[str, dict]:
    return {c["chunk_id"]: c for c in json.loads(config.CHUNKS_JSON.read_text("utf-8"))}


@lru_cache(maxsize=1)
def _sections() -> dict[str, dict]:
    data = json.loads(config.SECTIONS_JSON.read_text("utf-8"))
    return {s["section"]: s for s in data["sections"]}


@lru_cache(maxsize=1)
def _llm(fmt_json: bool = True):
    from langchain_ollama import ChatOllama

    return ChatOllama(model=config.LLM_MODEL, base_url=config.OLLAMA_BASE_URL,
                      temperature=config.LLM_TEMPERATURE, num_ctx=config.LLM_NUM_CTX,
                      num_predict=600, seed=42, format="json" if fmt_json else None)


def _explicit_refs(question: str) -> list[str]:
    """'What does section 8(6) say?' -> chunk ids for that clause (exact lookup)."""
    ids = []
    for num, subs in SECTION_REF.findall(question):
        levels = re.findall(r"\(\s*(\w{1,3})\s*\)", subs)
        prefix = "_".join([f"s{num}", *levels])
        ids += [cid for cid in _chunks() if cid == prefix or cid.startswith(prefix + "_")]
    return ids


_STOP = set("the of a an to and or in is for by be any such under this i my me can what do does how "
             "who which on with as it if that are am have has will would should".split())


def _tok(s: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in _STOP]


@lru_cache(maxsize=1)
def _bm25():
    from rank_bm25 import BM25Okapi
    from src.ingest import Chunk, embedding_text

    ids = list(_chunks())
    return ids, BM25Okapi([_tok(embedding_text(Chunk(**_chunks()[i]))) for i in ids])


HYDE_PROMPT = """Write ONE sentence in the formal drafting style of India's Digital Personal Data
Protection Act, 2023 that a provision answering this question might contain. Use the Act's terms
(Data Fiduciary, Data Principal, Board, processing, personal data) where they fit.
Question: {question}
Sentence:"""


def hypothetical_clause(question: str) -> str:
    """HyDE: users ask in everyday words ("sent to other countries"), the Act is drafted in
    legal words ("transfer ... outside India"). A short statute-style guess from the SLM is
    embedded as an extra query. Its content is only used for search, never shown."""
    try:
        return _llm(False).invoke(HYDE_PROMPT.format(question=question)).content.strip()[:400]
    except Exception:
        return ""


def retrieve(question: str, k: int = config.TOP_K, expand: bool = False) -> list[Retrieved]:
    """Hybrid retrieval: dense (MiniLM cosine) + BM25, merged by reciprocal-rank fusion,
    optionally with a HyDE query as a third ranked list.
    Dense catches paraphrase ("take back consent" ~ "withdraw"); BM25 catches exact legal
    terms ("Significant Data Fiduciary"). Each result keeps the dense cosine of the user's
    own question as `score`, which is what the out-of-scope threshold is applied to."""
    store = _store()
    dense = store.similarity_search_with_score(question, k=store.index.ntotal)
    cosine = {d.metadata["chunk_id"]: float(s) for d, s in dense}
    ids, bm = _bm25()
    bm_scores = bm.get_scores(_tok(question))
    sparse = sorted(range(len(ids)), key=lambda i: -bm_scores[i])[:20]
    lists = [[d.metadata["chunk_id"] for d, _ in dense[:20]], [ids[i] for i in sparse]]
    if expand and (hyde := hypothetical_clause(question)):
        lists.append([d.metadata["chunk_id"] for d, _ in store.similarity_search_with_score(hyde, k=20)])
    rrf: dict[str, float] = {}
    for ranked in lists:
        for rank, cid in enumerate(ranked):
            rrf[cid] = rrf.get(cid, 0.0) + 1.0 / (60 + rank)
    top = sorted(rrf, key=lambda c: -rrf[c])[:k]
    out = []
    for cid in top:
        c = _chunks()[cid]
        out.append(Retrieved(c["citation"], c["title"], c["text"], cosine[cid], cid, c["section"]))
    seen = {r.chunk_id for r in out}
    for cid in reversed(_explicit_refs(question)):
        if cid not in seen:
            c = _chunks()[cid]
            out.insert(0, Retrieved(c["citation"], c["title"], c["text"], 1.0, cid, c["section"]))
    return out


def _context(docs: list[Retrieved]) -> str:
    return "\n\n".join(f"[{d.citation}] ({d.title})\n{d.text}" for d in docs)


def _norm(cite: str) -> str:
    return re.sub(r"[^0-9a-z()]", "", cite.lower().replace("section", "s"))


def _fallback(question, reason, docs, t0) -> Answer:
    return Answer(question=question, answer=config.FALLBACK_MESSAGE, plain_language="",
                  original_clause="", sections=[], fallback=True, fallback_reason=reason,
                  retrieved=[_doc_dict(d) for d in docs], latency_s=round(time.perf_counter() - t0, 2))


def _doc_dict(d: Retrieved) -> dict:
    return {"citation": d.citation, "title": d.title, "score": round(d.score, 3)}


def ask(question: str) -> Answer:
    t0 = time.perf_counter()
    question = question.strip()
    docs = retrieve(question)
    best = max((d.score for d in docs), default=0.0)
    if best < config.SIM_THRESHOLD:   # cheap gate first: no LLM call for clearly unrelated questions
        return _fallback(question, f"best retrieval score {best:.2f} "
                                   f"< threshold {config.SIM_THRESHOLD}", docs, t0)
    if config.USE_HYDE:
        docs = retrieve(question, expand=True)

    chain = ChatPromptTemplate.from_messages([("system", ANSWER_SYSTEM), ("human", ANSWER_HUMAN)]) \
        | _llm() | JsonOutputParser()
    try:
        out = chain.invoke({"context": _context(docs), "question": question})
    except Exception as e:  # malformed JSON from the model
        return _fallback(question, f"model output could not be parsed: {type(e).__name__}", docs, t0)

    if not out.get("in_scope", True) or not str(out.get("answer", "")).strip():
        return _fallback(question, "model reported the retrieved clauses do not answer the question",
                         docs, t0)

    cited = _attribute(out, docs)
    return Answer(
        question=question,
        answer=str(out.get("answer", "")).strip(),
        plain_language=_as_text(out.get("plain_language", "")),
        original_clause="\n\n".join(f"[{d.citation}] {d.text}" for d in cited),
        sections=[d.citation for d in cited],
        retrieved=[_doc_dict(d) for d in docs],
        latency_s=round(time.perf_counter() - t0, 2),
    )


def _attribute(out: dict, docs: list[Retrieved], margin: float = 0.06, cap: int = 2) -> list[Retrieved]:
    """Pick the clause(s) the answer actually rests on.

    Phi-3-mini tends to list every clause it was shown, so its "sections" field alone is a
    weak signal. We embed the generated answer and score it against each retrieved clause;
    the best match is the primary citation, and other clauses within `margin` of it are
    kept only if the model also cited them. Explicit "section N" lookups always stay."""
    import numpy as np
    from src.embeddings import get_embeddings

    emb = get_embeddings()
    gen = f"{out.get('answer', '')} {_as_text(out.get('plain_language', ''))}"
    vecs = np.array(emb.embed_documents([gen] + [d.text for d in docs]))
    sims = vecs[1:] @ vecs[0]
    model_cited = {_norm(str(s)) for s in out.get("sections", [])}
    best = float(sims.max())
    order = sorted(range(len(docs)), key=lambda i: -sims[i])
    chosen = [docs[order[0]]]
    for i in order[1:]:
        if len(chosen) >= cap:
            break
        if (sims[i] >= best - margin and _norm(docs[i].citation) in model_cited) or docs[i].score == 1.0:
            chosen.append(docs[i])
    return chosen


def _as_text(v) -> str:
    if isinstance(v, list):
        return "\n".join(f"- {x}" for x in v)
    return str(v).strip()


def resolve_section(ref: str) -> tuple[str, str, str]:
    """'8(6)', 'Section 8(6)', 's8_6', '33', 'Schedule' -> (citation, title, verbatim text)."""
    ref = ref.strip()
    if ref.lower().startswith("schedule"):
        rows = [c for c in _chunks().values() if c["section"] == "Schedule"]
        return ("Schedule", rows[0]["title"], "\n".join(r["text"] for r in rows))
    m = re.match(r"^(?:s(?:ection|ec\.?)?\s*)?(\d{1,2})((?:\s*\(\s*\w{1,3}\s*\))*)$", ref, re.I) \
        or re.match(r"^s(\d{1,2})((?:_\w{1,3})*)$", ref)
    if not m:
        raise KeyError(f"Could not understand section reference '{ref}'. Try '8', '8(6)' or 'Section 17(1)(a)'.")
    num = m.group(1)
    levels = re.findall(r"\w{1,3}", m.group(2).replace("_", " ")) if m.group(2) else []
    if not levels:
        sec = _sections().get(num)
        if not sec:
            raise KeyError(f"Section {num} does not exist. The Act has sections 1-44.")
        return (f"Section {num}", sec["title"], sec["text"])
    prefix = "_".join([f"s{num}", *levels])
    parts = [c for cid, c in _chunks().items() if cid == prefix or cid.startswith(prefix + "_")]
    if not parts:
        raise KeyError(f"Section {num}" + "".join(f"({x})" for x in levels) + " was not found.")
    return ("Section " + num + "".join(f"({x})" for x in levels), parts[0]["title"],
            "\n".join(p["text"] for p in parts))


def simplify(ref: str) -> dict:
    t0 = time.perf_counter()
    citation, title, text = resolve_section(ref)
    chain = ChatPromptTemplate.from_messages([("system", SIMPLIFY_SYSTEM), ("human", SIMPLIFY_HUMAN)]) \
        | _llm() | JsonOutputParser()
    out = chain.invoke({"citation": citation, "title": title, "text": text})
    return {
        "section": citation,
        "title": title,
        "original_clause": text,
        "plain_language": _as_text(out.get("plain_language", "")),
        "key_points": [str(x) for x in out.get("key_points", [])][:8],
        "disclaimer": config.DISCLAIMER,
        "latency_s": round(time.perf_counter() - t0, 2),
    }


if __name__ == "__main__":
    import sys
    from dataclasses import asdict

    q = " ".join(sys.argv[1:]) or "What must a company do after a personal data breach?"
    print(json.dumps(asdict(ask(q)), indent=2, ensure_ascii=False))

"""Data pipeline: PDF -> clean text -> structure-aware chunks -> embeddings -> FAISS.

The Gazette PDF has a running header on every page, Hindi masthead text on page 1,
section titles printed as margin notes (left margin on odd pages, right on even), and
cross-reference notes like "24 of 1997." in the margins. We read words with their
coordinates, keep the body column, turn the margin notes into section titles, and
split by the Act's own structure (Chapter > Section > sub-section / definition clause).

Run:  python -m src.ingest            (builds index, prints sample chunks)
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from dataclasses import asdict, dataclass, field

import pdfplumber

from src import config

HEADER_BOTTOM = 85        # running header sits at top ~67
BODY_LEFT = 110           # left margin notes start at x0 ~58
BODY_RIGHT = 481          # right margin notes start at x0 ~485
LINE_TOL = 3              # words within 3pt vertically are one line
CROSS_REF = re.compile(r"^\d+\s+of\s+\d{4}\.?$|^\d+\s+of$|^\d{4}\.$")

SECTION_START = re.compile(r"^(\d{1,2})\.\s+(.*)")
SUBSECTION_START = re.compile(r"(?m)^\((\d{1,2})\)\s?(?=\S)")
DEFINITION_START = re.compile(r"(?m)^\(([a-z]{1,2})\)\s+[\"“]")
CHAPTER = re.compile(r"^CHAPTER\s+([IVXL]+)$")
CLAUSE_START = re.compile(r"(?m)^\(([a-z])\)\s")
LONG_CHUNK = 1500         # MiniLM reads ~256 word pieces; split longer parts by clause
SCHEDULE_PENALTY_X = 400  # penalty column of the Schedule table starts at x0 ~406


@dataclass
class Chunk:
    chunk_id: str
    section: str          # "8"
    subsection: str       # "6", "a" (definition clause) or ""
    citation: str         # "Section 8(6)"
    title: str            # margin-note title, e.g. "General obligations of Data Fiduciary"
    chapter: str          # "CHAPTER II - OBLIGATIONS OF DATA FIDUCIARY"
    text: str             # verbatim clause text (cleaned of layout noise only)
    pages: list[int] = field(default_factory=list)


def download_pdf() -> None:
    if config.RAW_PDF.exists():
        return
    config.RAW_PDF.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {config.PDF_URL}")
    req = urllib.request.Request(config.PDF_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        config.RAW_PDF.write_bytes(r.read())


def _group_lines(words):
    lines: list[list[dict]] = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if lines and abs(lines[-1][0]["top"] - w["top"]) <= LINE_TOL:
            lines[-1].append(w)
        else:
            lines.append([w])
    return [(ln[0]["top"], " ".join(x["text"] for x in sorted(ln, key=lambda x: x["x0"])))
            for ln in lines]


def _margin_titles(words):
    """Group margin words into notes; keep titles, drop Act cross-references."""
    notes, cur, last_top = [], [], None
    for top, text in _group_lines(words):
        if last_top is not None and top - last_top > 14:
            notes.append(cur)
            cur = []
        cur.append((top, text))
        last_top = top
    if cur:
        notes.append(cur)
    titles = []
    for note in notes:
        text = " ".join(t for _, t in note).strip()
        if CROSS_REF.match(text) or re.fullmatch(r"[\d\sof.]+", text):
            continue
        titles.append((note[0][0], text.rstrip(".")))
    return titles


def extract_pages(pdf_path=config.RAW_PDF):
    """Yield (page_no, body_lines, margin_titles, schedule_words) per page."""
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            words = [w for w in page.extract_words(keep_blank_chars=False)
                     if w["top"] > HEADER_BOTTOM]
            body = [w for w in words if BODY_LEFT <= w["x0"] < BODY_RIGHT]
            margin = [w for w in words if not (BODY_LEFT <= w["x0"] < BODY_RIGHT)]
            yield i, _group_lines(body), _margin_titles(margin), words


def clean(text: str) -> str:
    text = text.replace("“", '"').replace("”", '"').replace("’", "'").replace("‘", "'")
    text = text.replace("––", "—").replace("–", "-")
    text = re.sub(r"[�-]+", "", text)   # decorative glyphs / bad bytes
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def parse_schedule(words) -> list[dict]:
    """The Schedule is a 3-column table: Sl. No. | breach | penalty."""
    # Drop the signature/printer block that follows the table.
    sig = [w["top"] for w in words if w["text"].startswith("DR.")]
    if sig:
        words = [w for w in words if w["top"] < min(sig) - 25]
    rows, cur = [], None
    for top, line in _group_lines([w for w in words if w["x0"] < SCHEDULE_PENALTY_X]):
        m = re.match(r"^(\d)\.\s+(.*)", line)
        if m:
            cur = {"no": m.group(1), "breach": m.group(2), "penalty": "", "top": top}
            rows.append(cur)
        elif cur and not line.startswith(("DR.", "Secretary", "Sl.", "(1)")):
            cur["breach"] += " " + line
    for top, line in _group_lines([w for w in words if w["x0"] >= SCHEDULE_PENALTY_X]):
        owner = None
        for r in rows:
            if r["top"] - 2 <= top:
                owner = r
        if owner and not line.startswith("("):
            owner["penalty"] += " " + line
    return [{k: clean(v) for k, v in r.items() if k != "top"} for r in rows]


def parse_act(pdf_path=config.RAW_PDF):
    """Return (sections, schedule_rows). sections: list of dicts in Act order."""
    sections: list[dict] = []
    chapter, pending_chapter = "", None
    started = False
    schedule_rows: list[dict] = []

    for page_no, lines, titles, words in extract_pages(pdf_path):
        if any(t.strip() == "THE SCHEDULE" for _, t in lines):
            sched_top = next(top for top, t in lines if t.strip() == "THE SCHEDULE")
            schedule_rows = parse_schedule([w for w in words if w["top"] > sched_top + 30])
            lines = [(top, t) for top, t in lines if top < sched_top]
        for top, line in lines:
            line = line.strip()
            if not started:
                started = line == "CHAPTER I"
                if not started:
                    continue
            if m := CHAPTER.match(line):
                pending_chapter = f"CHAPTER {m.group(1)}"
                continue
            if pending_chapter and line.isupper():
                chapter = f"{pending_chapter} - {line}"
                pending_chapter = None
                continue
            m = SECTION_START.match(line)
            expected = str(len(sections) + 1)
            if m and m.group(1) == expected:
                title = next((t for ttop, t in titles if abs(ttop - top) <= 12), "")
                sections.append({"section": expected, "title": title, "chapter": chapter,
                                 "lines": [m.group(2)], "pages": [page_no]})
                continue
            if sections:
                sec = sections[-1]
                if not sec["title"]:
                    sec["title"] = next((t for ttop, t in titles if abs(ttop - top) <= 12), "")
                sec["lines"].append(line)
                if page_no not in sec["pages"]:
                    sec["pages"].append(page_no)

    for sec in sections:
        sec["text"] = clean("\n".join(sec.pop("lines")))
        sec["title"] = clean(re.sub(r"\d+ of \d{4}\.?\s*", "", sec["title"]))
    return sections, schedule_rows


def chunk_sections(sections, schedule_rows) -> list[Chunk]:
    chunks: list[Chunk] = []
    for sec in sections:
        n, text = sec["section"], sec["text"]
        splitter = DEFINITION_START if n == "2" else SUBSECTION_START
        marks = list(splitter.finditer(text))
        if splitter is SUBSECTION_START:
            # Sub-sections run (1), (2), (3)...; a wrapped cross-reference such as
            # "sub-section\n(2) of section 10" must not start a new chunk.
            seq = []
            for m in marks:
                if int(m.group(1)) == len(seq) + 1:
                    seq.append(m)
            marks = seq
        if len(marks) < 2:
            parts = [("", text)]
        else:
            head = text[: marks[0].start()].strip()
            parts = []
            for j, m in enumerate(marks):
                end = marks[j + 1].start() if j + 1 < len(marks) else len(text)
                body = text[m.start():end].strip()
                if j == 0 and head:
                    body = head + "\n" + body   # keep the lead-in ("In this Act, ... -")
                parts.append((m.group(1), body))
        parts = [p for sub, body in parts for p in _split_long(sub, body)]
        for sub, body in parts:
            levels = re.findall(r"[^()]+", sub)          # "1(a)" -> ["1", "a"]
            cite = f"Section {n}" + "".join(f"({p})" for p in levels)
            chunks.append(Chunk(
                chunk_id="_".join([f"s{n}", *levels]),
                section=n, subsection=sub, citation=cite, title=sec["title"],
                chapter=sec["chapter"], text=body, pages=sec["pages"],
            ))
    for row in schedule_rows:
        chunks.append(Chunk(
            chunk_id=f"schedule_{row['no']}", section="Schedule", subsection=row["no"],
            citation=f"Schedule, item {row['no']}",
            title="Penalties (Schedule, see section 33(1))", chapter="THE SCHEDULE",
            text=f"{row['no']}. Breach: {row['breach']}\nPenalty: {row['penalty']}",
            pages=[21],
        ))
    return chunks


def _split_long(sub: str, body: str):
    """Split an over-long part into its (a), (b), ... clauses. Each clause keeps the
    lead-in sentence (e.g. "...shall not apply where-") so it still reads as law;
    the gap between lead-in and clause is marked with an ellipsis."""
    # Clauses run (a), (b), (c)...; "(i)", "(ii)" inside a clause are roman sub-items,
    # so only accept the next expected letter.
    marks = []
    for m in CLAUSE_START.finditer(body):
        if m.group(1) == chr(ord("a") + len(marks)):
            marks.append(m)
    if len(body) <= LONG_CHUNK or len(marks) < 2:
        return [(sub, body)]
    lead = body[: marks[0].start()].strip()
    out = []
    for j, m in enumerate(marks):
        end = marks[j + 1].start() if j + 1 < len(marks) else len(body)
        clause = body[m.start():end].strip()
        text = f"{lead}\n{clause}" if j == 0 else f"{lead}\n...\n{clause}"
        out.append((f"{sub}({m.group(1)})" if sub else m.group(1), text))
    return out


def embedding_text(c: Chunk) -> str:
    """What gets embedded: citation + title + chapter give the retriever the context
    a bare sub-section lacks ("(6) In the event of a breach..." says nothing about who)."""
    return f"{c.citation} - {c.title}. {c.chapter}.\n{c.text}"


def build_index(chunks: list[Chunk]):
    from langchain_community.vectorstores import FAISS
    from langchain_community.vectorstores.utils import DistanceStrategy
    from langchain_core.documents import Document
    from src.embeddings import get_embeddings

    docs = [Document(page_content=embedding_text(c), metadata=asdict(c)) for c in chunks]
    store = FAISS.from_documents(docs, get_embeddings(),
                                 distance_strategy=DistanceStrategy.MAX_INNER_PRODUCT)
    store.save_local(str(config.INDEX_DIR))
    return store


def main(argv=None) -> None:
    argv = argv or sys.argv[1:]
    download_pdf()
    sections, schedule = parse_act()
    chunks = chunk_sections(sections, schedule)
    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    config.SECTIONS_JSON.write_text(json.dumps(
        {"sections": sections, "schedule": schedule}, indent=2, ensure_ascii=False), "utf-8")
    config.CHUNKS_JSON.write_text(json.dumps(
        [asdict(c) for c in chunks], indent=2, ensure_ascii=False), "utf-8")

    print(f"Parsed {len(sections)} sections, {len(schedule)} schedule rows -> {len(chunks)} chunks")
    lengths = sorted(len(c.text) for c in chunks)
    print(f"Chunk length (chars): min {lengths[0]}, median {lengths[len(lengths)//2]}, max {lengths[-1]}")
    print("\nSections found:")
    for s in sections:
        print(f"  {s['section']:>2}. {s['title'][:60]:<60} p.{s['pages'][0]}")
    print("\nSample chunks:")
    for cid in ("s2_f", "s6_1", "s8_6", "s17_1_c", "schedule_1"):
        c = next((c for c in chunks if c.chunk_id == cid), None)
        if c:
            print(f"--- [{c.citation}] {c.title} | {c.chapter} | pages {c.pages}")
            print(c.text[:600] + ("..." if len(c.text) > 600 else ""))
    if "--no-index" not in argv:
        build_index(chunks)
        print(f"\nFAISS index with {len(chunks)} vectors saved to {config.INDEX_DIR}")


if __name__ == "__main__":
    main()

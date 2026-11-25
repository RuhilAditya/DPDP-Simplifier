"""DoD 3: run the held-out test set and write a results table.

Automatic columns:
  retrieval_hit  expected clause is among the retrieved top-k
  citation_hit   expected clause is among the sections the answer cites
  facts          share of key facts present in answer + plain_language
  auto_pass      citation_hit and all facts present and no fallback
Manual column (eval/manual_review.json, filled by a human reading the outputs against the Act):
  meaning_preserved  does the plain-language rewrite keep the legal meaning?
Final "correct" = auto_pass and meaning_preserved (manual verdict wins when present).

Run:  python -m eval.run_eval
"""
import csv
import json
from dataclasses import asdict, is_dataclass
from datetime import datetime
from pathlib import Path

from src import config
from src.rag import ask

HERE = Path(__file__).parent


def _d(a) -> dict:
    d = asdict(a) if is_dataclass(a) else dict(vars(a))
    d.pop("id", None)
    return d


class _Replay:
    """--report-only: re-score a saved run (e.g. after adding manual verdicts) without the SLM."""
    def __init__(self, path):
        self.by_q = {r["question"]: r for r in json.loads(Path(path).read_text("utf-8"))["raw"]}

    def __call__(self, question):
        from types import SimpleNamespace
        return SimpleNamespace(**self.by_q[question])


def main() -> None:
    import sys
    source = None
    if "--report-only" in sys.argv:
        i = sys.argv.index("--report-only")
        source = sys.argv[i + 1] if len(sys.argv) > i + 1 else str(HERE / "results.json")
    answer_fn = _Replay(source) if source else ask
    qs = json.loads((HERE / "questions.json").read_text("utf-8"))
    manual_path = HERE / "manual_review.json"
    manual = json.loads(manual_path.read_text("utf-8")) if manual_path.exists() else {}
    rows, raw = [], []

    for q in qs["in_scope"]:
        a = answer_fn(q["question"])
        text = f"{a.answer} {a.plain_language}".lower()
        found = [any(p.lower() in text for p in fact) for fact in q["key_facts"]]
        retrieved = [r["citation"] for r in a.retrieved]
        row = {
            "id": q["id"], "type": "in-scope", "question": q["question"],
            "expected": " / ".join(q["expected_sections"]),
            "cited": ", ".join(a.sections) or "-",
            "retrieval_hit": any(s in retrieved for s in q["expected_sections"]),
            "citation_hit": any(s in a.sections for s in q["expected_sections"]),
            "facts": f"{sum(found)}/{len(found)}",
            "fallback": a.fallback,
            "latency_s": a.latency_s,
        }
        row["auto_pass"] = row["citation_hit"] and all(found) and not a.fallback
        m = manual.get(q["id"], {})
        if (m.get("reviewed_answer"), m.get("reviewed_plain_language")) != (a.answer, a.plain_language):
            m = {}   # output changed since the human review: verdict no longer applies
        row["meaning_preserved"] = m.get("meaning_preserved", "unreviewed")
        row["correct"] = row["auto_pass"] and m.get("meaning_preserved", True) is True
        row["notes"] = m.get("notes", "")
        rows.append(row)
        raw.append({"id": q["id"], **_d(a)})
        print(f"{q['id']:>3} correct={row['correct']!s:5} cited={row['cited']} facts={row['facts']}")

    for q in qs["out_of_scope"]:
        a = answer_fn(q["question"])
        m = manual.get(q["id"], {})
        rows.append({
            "id": q["id"], "type": "out-of-scope", "question": q["question"],
            "expected": "fallback", "cited": ", ".join(a.sections) or "-",
            "retrieval_hit": "", "citation_hit": "", "facts": "",
            "fallback": a.fallback, "latency_s": a.latency_s, "auto_pass": a.fallback,
            "meaning_preserved": "", "correct": a.fallback,
            "notes": m.get("notes", a.fallback_reason or ""),
        })
        raw.append({"id": q["id"], **_d(a)})
        print(f"{q['id']:>3} fallback={a.fallback} ({a.fallback_reason})")

    ins = [r for r in rows if r["type"] == "in-scope"]
    oos = [r for r in rows if r["type"] == "out-of-scope"]
    summary = {
        "run_at": datetime.now().isoformat(timespec="seconds"),
        "model": config.LLM_MODEL, "embed_model": config.EMBED_MODEL,
        "top_k": config.TOP_K, "sim_threshold": config.SIM_THRESHOLD,
        "temperature": config.LLM_TEMPERATURE,
        "retrieval_hit": f"{sum(r['retrieval_hit'] for r in ins)}/{len(ins)}",
        "citation_hit": f"{sum(r['citation_hit'] for r in ins)}/{len(ins)}",
        "auto_pass": f"{sum(r['auto_pass'] for r in ins)}/{len(ins)}",
        "correct_in_scope": f"{sum(r['correct'] for r in ins)}/{len(ins)}",
        "fallback_correct": f"{sum(r['correct'] for r in oos)}/{len(oos)}",
        "manual_review_done": all(r["meaning_preserved"] != "unreviewed" for r in ins),
        "mean_latency_s": round(sum(r["latency_s"] for r in rows) / len(rows), 1),
    }

    if source:
        summary["replayed_from"] = Path(source).name
    (HERE / "results.json").write_text(json.dumps({"summary": summary, "rows": rows, "raw": raw},
                                                  indent=2, ensure_ascii=False), "utf-8")
    with open(HERE / "results.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    yn = lambda v: "✅" if v is True else "❌" if v is False else str(v)
    md = [f"# Evaluation results (held-out test set)\n",
          f"Run {summary['run_at']} · `{config.LLM_MODEL}` · `{config.EMBED_MODEL}` · hybrid top-k={config.TOP_K} · "
          f"threshold={config.SIM_THRESHOLD} · temperature={config.LLM_TEMPERATURE}\n",
          f"**In-scope correct: {summary['correct_in_scope']}** (retrieval hit {summary['retrieval_hit']}, "
          f"citation hit {summary['citation_hit']}, automatic fact check {summary['auto_pass']}) · "
          f"**Out-of-scope fallback: {summary['fallback_correct']}** · mean latency {summary['mean_latency_s']} s\n",
          "| ID | Question | Expected | Cited | Retrieved | Cited correctly | Key facts | Meaning kept (manual) | Correct | Notes |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        md.append(f"| {r['id']} | {r['question']} | {r['expected']} | {r['cited']} | {yn(r['retrieval_hit'])} | "
                  f"{yn(r['citation_hit'])} | {r['facts']} | {yn(r['meaning_preserved'])} | {yn(r['correct'])} | {r['notes']} |")
    md.append("\nFull answers, rewrites and retrieved clauses: `eval/results.json`.")
    (HERE / "results.md").write_text("\n".join(md) + "\n", "utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

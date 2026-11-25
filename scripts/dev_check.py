"""Run the full pipeline on the DEV set (used for tuning; the test set is eval/run_eval.py)."""
import json
from src.rag import ask

d = json.load(open("eval/dev_questions.json", encoding="utf-8"))
for q in d["in_scope"]:
    a = ask(q["question"])
    ok = any(s in q["expected_sections"] for s in a.sections)
    print(f"IN  fb={a.fallback!s:5} cite_ok={ok!s:5} {a.sections} {q['question']}\n    A: {a.answer[:220]}\n    P: {a.plain_language[:220]}")
for q in d["out_of_scope"]:
    a = ask(q)
    print(f"OUT fb={a.fallback!s:5} {q} | {a.fallback_reason or a.answer[:150]}")

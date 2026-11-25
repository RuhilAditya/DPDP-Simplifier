"""Replays postman/DPDP_Simplifier.postman_collection.json against the running API and applies the
same checks as the collection's Postman test scripts (translated to Python, one check per pm.test).

Usage: python -m scripts.replay_postman [--base http://localhost:8000]
Writes evidence/api/postman_replay.json. Not a substitute for running the collection in Postman itself.
"""
from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
COLLECTION = ROOT / "postman" / "DPDP_Simplifier.postman_collection.json"
OUT = ROOT / "evidence" / "api" / "postman_replay.json"

# name -> list of (test name, check(status, body)); mirrors each pm.test in the collection
CHECKS = {
    "Health": [
        ("200 OK", lambda s, b: s == 200),
        ("status ok", lambda s, b: b["status"] == "ok"),
        ("phi3:mini available in Ollama", lambda s, b: b["ollama"]["model_available"] is True),
        ("index loaded", lambda s, b: b["chunks"] > 100),
    ],
    "Sections (table of contents)": [
        ("200 OK", lambda s, b: s == 200),
        ("44 sections + Schedule", lambda s, b: len(b) == 45),
        ("Section 8 title", lambda s, b: "General obligations" in b[7]["title"]),
    ],
    "Ask - consent withdrawal (in scope)": [
        ("200 OK", lambda s, b: s == 200),
        ("not a fallback", lambda s, b: b["fallback"] is False),
        ("cites Section 6(4)", lambda s, b: "Section 6(4)" in b["sections"]),
        ("verbatim clause returned", lambda s, b: "withdraw her consent at any time" in b["original_clause"]),
        ("has plain-language rewrite", lambda s, b: len(b["plain_language"]) > 10),
        ("has disclaimer", lambda s, b: "not legal advice" in b["disclaimer"]),
    ],
    "Ask - who is a child (in scope)": [
        ("200 OK", lambda s, b: s == 200),
        ("cites Section 2(f)", lambda s, b: "Section 2(f)" in b["sections"]),
        ("mentions eighteen", lambda s, b: re.search(r"eighteen|18", (b["answer"] + b["plain_language"]).lower()) is not None),
    ],
    "Ask - maximum penalty (in scope)": [
        ("200 OK", lambda s, b: s == 200),
        ("cites Schedule item 1", lambda s, b: "Schedule, item 1" in b["sections"]),
        ("250 crore", lambda s, b: re.search(r"two hundred and fifty crore|250 crore", (b["answer"] + b["plain_language"]).lower()) is not None),
    ],
    "Ask - IT Act penalty (out of scope -> fallback)": [
        ("200 OK", lambda s, b: s == 200),
        ("graceful fallback", lambda s, b: b["fallback"] is True),
        ("says not covered", lambda s, b: "don't have information" in b["answer"]),
        ("no citations invented", lambda s, b: len(b["sections"]) == 0),
    ],
    "Ask - validation error (too short)": [
        ("422 Unprocessable", lambda s, b: s == 422),
    ],
    "Simplify - Section 8(6)": [
        ("200 OK", lambda s, b: s == 200),
        ("resolved citation", lambda s, b: b["section"] == "Section 8(6)"),
        ("verbatim clause", lambda s, b: "In the event of a personal data breach" in b["original_clause"]),
        ("rewrite present", lambda s, b: len(b["plain_language"]) > 20),
    ],
    "Simplify - unknown section (404)": [
        ("404 Not Found", lambda s, b: s == 404),
        ("helpful message", lambda s, b: "sections 1-44" in b["detail"]),
    ],
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    args = ap.parse_args()
    col = json.loads(COLLECTION.read_text(encoding="utf-8"))
    results, passed, total = [], 0, 0
    for item in col["item"]:
        req = item["request"]
        url = (req["url"]["raw"] if isinstance(req["url"], dict) else req["url"]).replace("{{baseUrl}}", args.base)
        body = req.get("body", {}).get("raw")
        t0 = time.perf_counter()
        r = requests.request(req["method"], url, data=body.encode() if body else None,
                             headers={"Content-Type": "application/json"} if body else None, timeout=180)
        ms = round((time.perf_counter() - t0) * 1000)
        try:
            data = r.json()
        except ValueError:
            data = None
        tests = []
        for name, fn in CHECKS[item["name"]]:
            try:
                ok = bool(fn(r.status_code, data))
            except Exception:
                ok = False
            tests.append({"test": name, "passed": ok})
        n_ok = sum(t["passed"] for t in tests)
        passed += n_ok; total += len(tests)
        results.append({"request": item["name"], "method": req["method"], "path": url.replace(args.base, ""),
                        "status": r.status_code, "time_ms": ms, "tests_passed": n_ok, "tests_total": len(tests), "tests": tests})
        print(f"{'PASS' if n_ok == len(tests) else 'FAIL'}  {n_ok}/{len(tests)}  {r.status_code}  {ms:>6} ms  {item['name']}")
    summary = {"run_at": datetime.now().isoformat(timespec="seconds"), "base_url": args.base,
               "requests": len(results), "assertions_passed": passed, "assertions_total": total}
    OUT.write_text(json.dumps({"summary": summary, "results": results}, indent=2), encoding="utf-8")
    print(f"\n{passed}/{total} assertions passed across {len(results)} requests -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

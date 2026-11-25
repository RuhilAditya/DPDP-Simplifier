"""DoD 2: prove Phi-3-mini loads locally through Ollama and answers basic prompts correctly.

Run:  python -m scripts.smoke_test_slm
Writes evidence/dod2_slm_smoke_test.json and prints a short report.
"""
import json
import platform
import time
from datetime import datetime, timezone

import requests
from langchain_ollama import ChatOllama

from src import config

TESTS = [
    ("What is the capital of India? Answer with one word.", ["delhi"]),
    ("What is 12 multiplied by 7? Answer with just the number.", ["84"]),
    ("In one sentence, what does 'personal data' mean?", ["person", "individual", "identif"]),
]


def main() -> None:
    tags = requests.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=10).json()
    models = {m["name"]: m for m in tags.get("models", [])}
    assert config.LLM_MODEL in models, f"{config.LLM_MODEL} not pulled; run: ollama pull {config.LLM_MODEL}"
    version = requests.get(f"{config.OLLAMA_BASE_URL}/api/version", timeout=10).json()["version"]
    info = requests.post(f"{config.OLLAMA_BASE_URL}/api/show", json={"model": config.LLM_MODEL},
                         timeout=30).json().get("details", {})

    llm = ChatOllama(model=config.LLM_MODEL, base_url=config.OLLAMA_BASE_URL,
                     temperature=0, num_ctx=config.LLM_NUM_CTX)
    results = []
    for prompt, expected_any in TESTS:
        t0 = time.perf_counter()
        answer = llm.invoke(prompt).content.strip()
        dt = time.perf_counter() - t0
        ok = any(e in answer.lower() for e in expected_any)
        results.append({"prompt": prompt, "answer": answer, "expected_any": expected_any,
                        "passed": ok, "latency_s": round(dt, 2)})
        print(f"[{'PASS' if ok else 'FAIL'}] {dt:5.1f}s  {prompt}\n        -> {answer[:200]}")

    loaded = requests.get(f"{config.OLLAMA_BASE_URL}/api/ps", timeout=10).json().get("models", [])
    evidence = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "host": platform.platform(),
        "ollama_version": version,
        "model": config.LLM_MODEL,
        "model_details": info,
        "model_size_bytes": models[config.LLM_MODEL]["size"],
        "loaded_in_ollama": [{"name": m["name"], "size_vram": m.get("size_vram")} for m in loaded],
        "results": results,
        "all_passed": all(r["passed"] for r in results),
    }
    out = config.ROOT / "evidence" / "dod2_slm_smoke_test.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print(f"\nModel: {config.LLM_MODEL} ({info.get('parameter_size')}, {info.get('quantization_level')}), "
          f"Ollama {version}. All passed: {evidence['all_passed']}. Evidence: {out}")


if __name__ == "__main__":
    main()

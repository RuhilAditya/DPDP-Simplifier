"""Fast tests (no Ollama needed): parsing, chunking, section lookup, fallback gate, API contract.

Run:  pytest -q
"""
import json

import pytest
from fastapi.testclient import TestClient

from src import config, rag
from src.ingest import chunk_sections, parse_act

pytestmark = pytest.mark.skipif(not config.RAW_PDF.exists(), reason="run python -m src.ingest first")


@pytest.fixture(scope="module")
def parsed():
    sections, schedule = parse_act()
    return sections, schedule, chunk_sections(sections, schedule)


def test_all_44_sections_in_order(parsed):
    sections, _, _ = parsed
    assert [s["section"] for s in sections] == [str(i) for i in range(1, 45)]
    assert sections[7]["title"] == "General obligations of Data Fiduciary"
    assert not any("of 19" in s["title"] or "of 18" in s["title"] for s in sections), "cross-ref leaked into title"


def test_no_gazette_noise(parsed):
    _, _, chunks = parsed
    text = " ".join(c.text for c in chunks)
    assert "GAZETTE OF INDIA" not in text
    assert "REETA VASISHTA" not in text


def test_schedule_penalties(parsed):
    _, schedule, _ = parsed
    assert len(schedule) == 7
    assert schedule[0]["penalty"] == "May extend to two hundred and fifty crore rupees."
    assert "section 15" in schedule[4]["breach"] and "ten thousand" in schedule[4]["penalty"]


def test_subsection_and_clause_chunks(parsed):
    _, _, chunks = parsed
    by_id = {c.chunk_id: c for c in chunks}
    assert len(by_id) == len(chunks), "duplicate chunk ids"
    assert by_id["s8_6"].citation == "Section 8(6)"
    assert by_id["s8_6"].text.startswith("(6) In the event of a personal data breach")
    assert by_id["s2_f"].text.startswith('(f) "child"')
    assert by_id["s13_1"].citation == "Section 13(1)"          # printed as "(1)A" with no space
    assert by_id["s17_1_c"].text.startswith("(1) The provisions of Chapter II")  # lead-in kept
    assert "s7_i" in by_id and by_id["s7_i"].text.count("(i) ") <= 2


@pytest.mark.parametrize("ref,cite", [("8(6)", "Section 8(6)"), ("Section 6", "Section 6"),
                                      ("section 17(1)(a)", "Section 17(1)(a)"), ("Schedule", "Schedule")])
def test_resolve_section(ref, cite):
    assert rag.resolve_section(ref)[0] == cite


def test_resolve_unknown_section():
    with pytest.raises(KeyError):
        rag.resolve_section("99")


def test_out_of_scope_gate_skips_llm(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("LLM must not be called below the threshold")
    monkeypatch.setattr(rag, "_llm", boom)
    a = rag.ask("Which cricket team won the 2011 World Cup?")
    assert a.fallback and a.sections == [] and a.answer == config.FALLBACK_MESSAGE


def test_explicit_section_reference_is_retrieved():
    assert rag.retrieve("What does section 9(3) say?")[0].citation == "Section 9(3)"


def test_api_contract_without_llm(monkeypatch):
    from src.api import app

    monkeypatch.setattr(rag, "_llm", lambda *a, **k: (_ for _ in ()).throw(AssertionError()))
    with TestClient(app) as client:
        r = client.post("/ask", json={"question": "How do I apply for a passport?"})
        assert r.status_code == 200
        body = r.json()
        assert body["fallback"] is True and body["disclaimer"].endswith("before acting on it.")
        assert client.post("/ask", json={"question": "a"}).status_code == 422
        assert client.post("/simplify", json={"section": "99"}).status_code == 404
        assert len(client.get("/sections").json()) == 45


def test_eval_files_are_disjoint():
    test = json.loads((config.ROOT / "eval/questions.json").read_text("utf-8"))
    dev = json.loads((config.ROOT / "eval/dev_questions.json").read_text("utf-8"))
    tq = {q["question"] for q in test["in_scope"] + test["out_of_scope"]}
    dq = {q["question"] for q in dev["in_scope"]} | set(dev["out_of_scope"])
    assert not tq & dq

"""FastAPI microservice for the DPDP Act simplifier.

  GET  /health            liveness + dependency status (Ollama, model, index)
  GET  /sections          table of contents (number, title, chapter) for browsing
  POST /ask               {question} -> answer, plain-language rewrite, verbatim clause, citations
  POST /simplify          {section}  -> plain-language rewrite of one section / sub-section
  GET  /docs              Swagger UI
  GET  /                  web frontend (frontend/index.html)

Run:  uvicorn src.api:app --port 8000
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import asdict

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from src import config, rag

FRONTEND = config.ROOT / "frontend"


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500,
                          examples=["What must a company do after a personal data breach?"])


class RetrievedClause(BaseModel):
    citation: str
    title: str
    score: float


class AskResponse(BaseModel):
    question: str
    answer: str
    plain_language: str
    original_clause: str
    sections: list[str]
    disclaimer: str
    fallback: bool
    fallback_reason: str | None = None
    retrieved: list[RetrievedClause]
    latency_s: float


class SimplifyRequest(BaseModel):
    section: str = Field(..., min_length=1, max_length=40, examples=["8(6)", "Section 6", "Schedule"])


class SimplifyResponse(BaseModel):
    section: str
    title: str
    original_clause: str
    plain_language: str
    key_points: list[str]
    disclaimer: str
    latency_s: float


class SectionInfo(BaseModel):
    section: str
    title: str
    chapter: str
    subsections: list[str]


def _ollama_status() -> dict:
    try:
        tags = requests.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=3).json()
        names = [m["name"] for m in tags.get("models", [])]
        return {"reachable": True, "model_available": config.LLM_MODEL in names}
    except requests.RequestException:
        return {"reachable": False, "model_available": False}


def _llm_unavailable(e: Exception) -> HTTPException:
    return HTTPException(503, detail=f"The language model is unavailable ({type(e).__name__}). "
                                     f"Is Ollama running at {config.OLLAMA_BASE_URL} with "
                                     f"'{config.LLM_MODEL}' pulled?")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    rag._store()        # load embeddings + FAISS once, so the first request is not slow
    rag._bm25()
    yield


app = FastAPI(title="DPDP Act Simplifier", version="1.0.0", lifespan=lifespan,
              description="Ask questions about India's Digital Personal Data Protection Act, 2023 "
                          "and get plain-language answers with the exact clause cited. "
                          "General information, not legal advice.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    ollama = _ollama_status()
    index_ok = (config.INDEX_DIR / "index.faiss").exists()
    return {
        "status": "ok" if ollama["model_available"] and index_ok else "degraded",
        "model": config.LLM_MODEL,
        "ollama": ollama,
        "index_loaded": index_ok,
        "chunks": len(rag._chunks()) if index_ok else 0,
        "embed_model": config.EMBED_MODEL,
    }


@app.get("/sections", response_model=list[SectionInfo])
def sections():
    subs: dict[str, list[str]] = {}
    for c in rag._chunks().values():
        subs.setdefault(c["section"], []).append(c["citation"])
    out = [SectionInfo(section=s["section"], title=s["title"], chapter=s["chapter"],
                       subsections=subs.get(s["section"], [])) for s in rag._sections().values()]
    out.append(SectionInfo(section="Schedule", title="Penalties", chapter="THE SCHEDULE",
                           subsections=subs.get("Schedule", [])))
    return out


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    try:
        return asdict(rag.ask(req.question))
    except (requests.RequestException, ConnectionError, OSError) as e:
        raise _llm_unavailable(e) from e


@app.post("/simplify", response_model=SimplifyResponse)
def simplify(req: SimplifyRequest):
    try:
        return rag.simplify(req.section)
    except KeyError as e:
        raise HTTPException(404, detail=str(e.args[0])) from e
    except (requests.RequestException, ConnectionError, OSError) as e:
        raise _llm_unavailable(e) from e


if FRONTEND.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND), name="static")

    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(FRONTEND / "index.html")

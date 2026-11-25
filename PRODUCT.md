# Product

<!-- impeccable:product-schema 1 -->

> Written without an interview: the owner was away. Every fact comes from the project brief
> (CSL374 Project 11) or the built backend. Lines marked *Assumption* or *Open* need confirming.

## Platform

web

## Stack

Delegated (owner unavailable when asked): plain static HTML/CSS/JS in `frontend/`, served by the
FastAPI service at `/`, no build step. Chosen so the demo runs from one `uvicorn` command and the
Docker image needs no Node toolchain.

## Users

- Course examiners for CSL374 (Microservice Based Applications), watching a 5-minute live demo on a
  laptop and a projector, then trying their own questions.
- *Assumption:* the intended end user is an ordinary Indian citizen or small-business owner who wants
  to know what the Digital Personal Data Protection (DPDP) Act, 2023 says about a concrete situation,
  without reading statute language.

## Product Purpose

Answer plain-language questions about the DPDP Act, 2023, and simplify any of its clauses, without
changing legal meaning. Every answer shows the exact clause it rests on, so the reader can check the
rewrite against the law. Success: the right clause is found, the rewrite keeps every condition,
"shall/may" and exception, and questions the Act does not cover get an honest "not covered".

## Positioning

A small local model (Phi-3-mini via Ollama) that never answers without showing the verbatim clause and
its citation (e.g. "Section 8(6)"), and that refuses outside the Act. The verbatim text is copied from
the index, never generated.

## Operating Context

- Source: the official Gazette PDF of the Act (44 sections in 9 chapters, plus a penalty Schedule).
- Answers take about 3–15 s on the demo laptop (RTX 4050, 6 GB). Out-of-scope refusals below the
  similarity threshold return in under 1 s.
- API: `POST /ask`, `POST /simplify`, `GET /sections`, `GET /health`.

## Capabilities and Constraints

- Ask: answer, plain-language rewrite, verbatim original clause, cited sections, fixed disclaimer,
  fallback flag and reason, retrieved clauses with similarity scores, latency.
- Simplify: any section, sub-section or clause ("8", "8(6)", "17(1)(a)", "Schedule").
- Browse: table of contents with all 44 section titles and chapters.
- Measured on the held-out test set: 6/10 strictly correct, 9/10 retrieval hit, 3/3 correct
  fallbacks. The interface must not imply more certainty than that.
- Not legal advice; the disclaimer must accompany every answer.

## Evidence on Hand

- `data/raw/dpdp_act_2023.pdf`, `data/processed/sections.json`, `data/processed/chunks.json`.
- `eval/results.md` (honest test results), `evidence/` (smoke test, ingestion output, API samples).
- No logo, brand assets, testimonials or user data exist. Do not fabricate them.

## Product Principles

1. The clause is the authority: show the law next to every rewrite, never instead of it.
2. Say "not covered" rather than guess.
3. Keep legal modality intact: must, must not, may.
4. Show your work: citations, retrieval scores and latency are visible, not hidden.

## Accessibility & Inclusion

Must read on a projector in a lit room and on a laptop: high contrast, large readable body type,
keyboard operable. *Open:* Hindi or other Indian-language support is not in scope.

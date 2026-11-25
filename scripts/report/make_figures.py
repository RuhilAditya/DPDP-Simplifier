"""Builds the report figures in docs/figures/ from the saved eval run, the chunk index and the UI screenshots.

Usage: python -m scripts.report.make_figures
(matplotlib is a report-only dependency: pip install matplotlib)
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "figures"
OUT.mkdir(parents=True, exist_ok=True)

INK, MUTED, RULE, ACCENT, OK = "#1c1b19", "#6b675f", "#b5b0a4", "#7a1f1f", "#2f5d3a"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10, "axes.edgecolor": RULE, "axes.labelcolor": INK,
    "xtick.color": MUTED, "ytick.color": MUTED, "axes.spines.top": False, "axes.spines.right": False,
    "savefig.dpi": 200, "savefig.bbox": "tight",
})

results = json.loads((ROOT / "eval" / "results.json").read_text(encoding="utf-8"))
summary, rows = results["summary"], results["rows"]
raw = {r["id"]: r for r in results["raw"]}
chunks = json.loads((ROOT / "data" / "processed" / "chunks.json").read_text(encoding="utf-8"))
frac = lambda s: tuple(int(x) for x in s.split("/"))


def architecture():
    fig, ax = plt.subplots(figsize=(10, 4.6))
    ax.set_xlim(0, 100); ax.set_ylim(0, 46); ax.axis("off")

    def box(x, y, w, h, text, fill="#ffffff", edge=INK, bold=False):
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="square,pad=0", fc=fill, ec=edge, lw=1.1))
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=7.9, color=INK,
                fontweight="bold" if bold else "normal", linespacing=1.35)

    def arrow(x1, y1, x2, y2, label=None, color=INK):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1), arrowprops=dict(arrowstyle="-|>", color=color, lw=1.1))
        if label:
            ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 1.2, label, ha="center", fontsize=7.4, color=color)

    ax.text(1, 44, "OFFLINE: ingestion (python -m src.ingest)", fontsize=8.5, color=MUTED, fontweight="bold")
    box(1, 33, 14, 9, "Gazette PDF\nDPDP Act, 2023")
    box(19, 33, 15, 9, "pdfplumber\nword coordinates\n+ cleaning")
    box(38, 33, 18, 9, "Structure-aware\nchunking: section /\nclause / Schedule row")
    box(60, 37, 17, 6, "MiniLM-L6-v2\nembeddings (CPU)")
    box(81, 37, 17, 6, "FAISS index\n(inner product)", fill="#f3f0e8")
    box(81, 29, 17, 6, "BM25 index\n(rank_bm25)", fill="#f3f0e8")
    arrow(15, 37.5, 19, 37.5); arrow(34, 37.5, 38, 37.5); arrow(56, 40, 60, 40); arrow(77, 40, 81, 40)
    arrow(56, 34, 81, 32)

    ax.text(1, 24, "ONLINE: one request (POST /ask)", fontsize=8.5, color=MUTED, fontweight="bold")
    box(1, 9, 12, 9, "Question\n(frontend /\nPostman)")
    box(17, 9, 15, 9, "Hybrid retrieve\ndense + BM25\nRRF, top-6")
    box(36, 9, 13, 9, "Similarity gate\nbest cosine\n>= 0.25 ?")
    box(53, 9, 15, 9, "LangChain chain\nPhi-3-mini via\nOllama, T = 0.1")
    box(72, 9, 12, 9, "Citation\nattribution\n(embedding)")
    box(87, 9, 12, 9, "JSON answer\n+ verbatim\nclause", bold=True)
    box(34, 0.3, 36, 5.2, "Fallback: not covered in the DPDP Act, 2023", fill="#f4e8e4", edge=ACCENT)
    arrow(13, 13.5, 17, 13.5); arrow(32, 13.5, 36, 13.5); arrow(49, 13.5, 53, 13.5, "yes")
    arrow(68, 13.5, 72, 13.5); arrow(84, 13.5, 87, 13.5)
    arrow(42.5, 9, 42.5, 5.5, color=ACCENT); ax.text(43.5, 7, "no", fontsize=7.4, color=ACCENT)
    arrow(60.5, 9, 60.5, 5.5, color=ACCENT); ax.text(61.5, 7, "in_scope = false", fontsize=7.4, color=ACCENT)
    arrow(89.5, 29, 26, 18.2, color=MUTED)
    ax.text(57, 25.5, "indexes loaded at API start-up", fontsize=7.4, color=MUTED, rotation=-6)
    fig.savefig(OUT / "architecture.png"); plt.close(fig)


def eval_funnel():
    labels = ["Expected clause\nretrieved (top-6)", "Expected clause\ncited", "Automatic\nkey-fact check",
              "Strictly correct\n(manual review)"]
    vals = [frac(summary[k])[0] for k in ("retrieval_hit", "citation_hit", "auto_pass", "correct_in_scope")]
    fig, ax = plt.subplots(figsize=(7.2, 3.2))
    bars = ax.barh(labels[::-1], vals[::-1], color=[ACCENT, INK, INK, INK], height=0.55)
    ax.axvline(8, color=MUTED, ls="--", lw=1); ax.text(8.08, 3.42, "DoD 3 target (8/10)", fontsize=8, color=MUTED)
    for b, v in zip(bars, vals[::-1]):
        ax.text(v + 0.12, b.get_y() + b.get_height() / 2, f"{v}/10", va="center", fontsize=9, color=INK)
    ax.set_xlim(0, 10.8); ax.set_xlabel("in-scope test questions (n = 10)")
    fo = frac(summary["fallback_correct"])
    ax.set_title(f"Held-out test results  ·  out-of-scope fallback {fo[0]}/{fo[1]}", fontsize=10, color=INK, loc="left")
    fig.savefig(OUT / "eval_funnel.png"); plt.close(fig)


def top_scores():
    ids = [r["id"] for r in rows]
    top = [max((d["score"] for d in raw[i]["retrieved"]), default=0) for i in ids]
    colors = [OK if r["type"] == "in-scope" and r["correct"] else (MUTED if r["type"] == "in-scope" else ACCENT) for r in rows]
    fig, ax = plt.subplots(figsize=(7.6, 3.2))
    ax.bar(ids, top, color=colors, width=0.62)
    ax.axhline(summary["sim_threshold"], color=INK, ls="--", lw=1)
    for x, v in enumerate(top):
        ax.text(x, v + 0.01, f"{v:.2f}", ha="center", fontsize=7.4, color=INK)
    ax.set_ylabel("best dense cosine score"); ax.set_ylim(0, max(top) + 0.12)
    from matplotlib.patches import Patch
    ax.legend(handles=[Patch(color=OK, label="in-scope, correct"), Patch(color=MUTED, label="in-scope, not strictly correct"),
                       Patch(color=ACCENT, label="out-of-scope"),
                       plt.Line2D([], [], color=INK, ls="--", lw=1, label=f"similarity gate ({summary['sim_threshold']})")],
              fontsize=7.6, frameon=False, ncol=4, loc="upper center",
              bbox_to_anchor=(0.5, 1.13))
    fig.savefig(OUT / "top_scores.png"); plt.close(fig)


def latency():
    ids = [r["id"] for r in rows]; lat = [r["latency_s"] for r in rows]
    fig, ax = plt.subplots(figsize=(7.6, 2.9))
    ax.bar(ids, lat, color=[ACCENT if r["fallback"] else INK for r in rows], width=0.62)
    for x, v in enumerate(lat):
        ax.text(x, v + 0.25, f"{v:.2f}" if v < 0.1 else f"{v:.1f}", ha="center", fontsize=7.4)
    ax.set_ylabel("seconds"); ax.set_ylim(0, max(lat) + 2)
    ax.annotate("first call: includes loading\nPhi-3 into memory", xy=(0.32, lat[0] - 1), xytext=(1.3, lat[0] - 3.5),
                fontsize=7.4, color=MUTED, arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.8))
    ax.text(11.5, 3.3, "O2, O3: stopped by\nthe gate, no model call", ha="center", fontsize=7.2, color=MUTED)
    from matplotlib.patches import Patch
    ax.legend(handles=[Patch(color=INK, label="answered"), Patch(color=ACCENT, label="fallback")], frameon=False, fontsize=7.6)
    fig.savefig(OUT / "latency.png"); plt.close(fig)


def chunk_lengths():
    L = [len(c["text"]) for c in chunks]
    fig, ax = plt.subplots(figsize=(7.2, 2.8))
    ax.hist(L, bins=28, color=INK, edgecolor="#ffffff", linewidth=0.6)
    ax.axvline(1500, color=ACCENT, ls="--", lw=1); ax.text(1480, ax.get_ylim()[1] * 0.85, "split limit 1,500", ha="right", fontsize=8, color=ACCENT)
    ax.set_xlabel("chunk length (characters)"); ax.set_ylabel("chunks")
    ax.set_title(f"{len(L)} chunks · median {sorted(L)[len(L)//2]} · max {max(L)}", fontsize=10, loc="left")
    fig.savefig(OUT / "chunk_lengths.png"); plt.close(fig)


def screenshots():
    shots = ROOT / "docs" / "screenshots"
    for name in ("answer", "not-covered", "simplify", "mobile"):
        src = shots / f"{name}.jpg"
        if src.exists():
            Image.open(src).convert("RGB").save(OUT / f"ui_{name.replace('-', '_')}.png", optimize=True)


def ncu_logo():
    """Renders docs/brand/NCU-Logo.svg (official file from ncuindia.edu) to PNG for the report title page.
    The SVG colours its shapes through CSS classes, which MuPDF ignores, so they are inlined first."""
    import re
    src = ROOT / "docs" / "brand" / "NCU-Logo.svg"
    if not src.exists():
        return
    import pymupdf  # report-only dependency: pip install pymupdf
    svg = src.read_text(encoding="utf-8")
    fills = dict(re.findall(r"\.(st\d+)\s*\{\s*fill:\s*([^;]+);", svg))
    svg = re.sub(r'class="(st\d+)"', lambda m: f'fill="{fills.get(m.group(1), "#000")}"', svg)
    pix = pymupdf.open(stream=svg.encode(), filetype="svg")[0].get_pixmap(matrix=pymupdf.Matrix(8, 8), alpha=False)
    pix.save(OUT / "ncu_logo.png")


if __name__ == "__main__":
    for fn in (architecture, eval_funnel, top_scores, latency, chunk_lengths, screenshots, ncu_logo):
        fn()
    print("figures:", sorted(p.name for p in OUT.glob("*.png")))

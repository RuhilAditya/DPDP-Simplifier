"""Central configuration. Every value can be overridden with an environment variable."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
RAW_PDF = Path(os.getenv("DPDP_PDF", DATA_DIR / "raw" / "dpdp_act_2023.pdf"))
PDF_URL = os.getenv(
    "DPDP_PDF_URL",
    "https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf",
)
PROCESSED_DIR = DATA_DIR / "processed"
CHUNKS_JSON = PROCESSED_DIR / "chunks.json"
SECTIONS_JSON = PROCESSED_DIR / "sections.json"
INDEX_DIR = PROCESSED_DIR / "faiss_index"

EMBED_MODEL = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MODEL = os.getenv("LLM_MODEL", "phi3:mini")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.1"))
LLM_NUM_CTX = int(os.getenv("LLM_NUM_CTX", "4096"))

TOP_K = int(os.getenv("TOP_K", "6"))
# Cosine similarity below which we say "not covered in this document".
# Chosen on the dev questions in eval/dev_questions.json, never on the test set.
SIM_THRESHOLD = float(os.getenv("SIM_THRESHOLD", "0.25"))
# HyDE query expansion (one extra SLM call). Tried after run 1; dev recall@6 fell 6/8 -> 5/8, so OFF.
USE_HYDE = os.getenv("USE_HYDE", "0") == "1"

DISCLAIMER = (
    "This is general information about the Digital Personal Data Protection Act, 2023, "
    "not legal advice. Check the original text or consult a qualified lawyer before acting on it."
)
FALLBACK_MESSAGE = (
    "I don't have information on that. It is not covered in the Digital Personal Data "
    "Protection Act, 2023."
)

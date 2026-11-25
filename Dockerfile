# DPDP Act Simplifier API. Ollama runs on the host; the container reaches it at host.docker.internal.
#   docker build -t dpdp-simplifier .
#   docker run --rm -p 8000:8000 --add-host=host.docker.internal:host-gateway dpdp-simplifier
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/app/.hf \
    OLLAMA_BASE_URL=http://host.docker.internal:11434

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the embedding model into the image so the container starts offline.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

COPY src ./src
COPY frontend ./frontend
COPY data/raw ./data/raw
# Rebuild the index inside the image so it always matches the code.
RUN python -m src.ingest > /dev/null

RUN useradd --create-home app && chown -R app /app
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=4)"
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]

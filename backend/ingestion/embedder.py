import json
import logging
import os
import time
import urllib.error
import urllib.request

from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "jina-embeddings-v3"
EMBEDDING_DIMENSIONS = 1024
EMBEDDING_BATCH_SIZE = 32
EMBEDDING_API_URL = "https://api.jina.ai/v1/embeddings"


def _get_api_key() -> str:
    api_key = os.environ.get("JINA_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("JINA_API_KEY is not configured")
    return api_key


def _embed_texts_once(texts: list[str], task: str) -> list[list[float]]:
    payload = json.dumps(
        {
            "model": EMBEDDING_MODEL,
            "task": task,
            "input": texts,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        EMBEDDING_API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {_get_api_key()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Jina embedding failed ({exc.code}): {error_body}") from exc

    data = body.get("data") or []
    embeddings = [item.get("embedding") or [] for item in data]
    if len(embeddings) != len(texts) or any(not vector for vector in embeddings):
        raise RuntimeError("Jina returned an incomplete embedding batch")

    return [[float(value) for value in vector] for vector in embeddings]


@retry(wait=wait_exponential(multiplier=1, min=2, max=60), stop=stop_after_attempt(5))
def _embed_texts(texts: list[str], task: str) -> list[list[float]]:
    try:
        return _embed_texts_once(texts, task)
    except RuntimeError as exc:
        message = str(exc).lower()
        if "429" in message or "503" in message:
            time.sleep(2)
            return _embed_texts_once(texts, task)
        raise


def generate_embeddings(batch_texts: list[str]) -> list[list[float]]:
    embeddings: list[list[float]] = []

    for index in range(0, len(batch_texts), EMBEDDING_BATCH_SIZE):
        batch = batch_texts[index : index + EMBEDDING_BATCH_SIZE]
        embeddings.extend(_embed_texts(batch, "retrieval.passage"))

    return embeddings


def embed_query(search_query: str) -> list[float]:
    return _embed_texts([search_query], "retrieval.query")[0]

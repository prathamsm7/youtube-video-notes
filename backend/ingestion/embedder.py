from tenacity import retry, stop_after_attempt, wait_exponential

from clients.gemini import client


@retry(wait=wait_exponential(multiplier=1, min=2, max=60), stop=stop_after_attempt(5))
def generate_embeddings(batch_texts: list[str]) -> list[list[float]]:
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=batch_texts,
        config={"task_type": "RETRIEVAL_DOCUMENT"},
    )
    return [embedding.values for embedding in result.embeddings]

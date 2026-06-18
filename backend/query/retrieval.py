import logging

from ingestion.embedder import embed_query
from clients.qdrant import qdrant_client

logger = logging.getLogger(__name__)


def get_all_chunks(video_id: str) -> list[str]:
    """Scroll all stored chunks for a video, ordered by point id (chronological)."""
    collection_name = f"video_{video_id.replace('-', '_')}"

    if not qdrant_client.collection_exists(collection_name=collection_name):
        logger.warning("Qdrant collection does not exist: %s", collection_name)
        return []

    ordered: list[tuple[int, str]] = []
    offset = None

    while True:
        records, next_offset = qdrant_client.scroll(
            collection_name=collection_name,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )

        for record in records:
            text = (record.payload or {}).get("text", "")
            if text:
                ordered.append((record.id, text))

        if next_offset is None:
            break
        offset = next_offset

    ordered.sort(key=lambda item: item[0])
    return [text for _, text in ordered]


def filter_chunks(results, threshold: float = 0.7) -> list[str]:
    docs: list[str] = []

    points = results.points if hasattr(results, "points") else results
    logger.info("Retrieved %s points from Qdrant", len(points))

    for hit in points:
        score = getattr(hit, "score", 0)
        payload = getattr(hit, "payload", {})

        if score >= threshold:
            text = payload.get("text", "")
            if text:
                docs.append(text)

    if not docs:
        logger.warning("No chunks passed the similarity threshold of %s", threshold)

    return docs


def retrieve_context(video_id: str, search_query: str, limit: int = 10, threshold: float = 0.6) -> str | None:
    collection_name = f"video_{video_id.replace('-', '_')}"

    query_embedding = embed_query(search_query)

    try:
        results = qdrant_client.query_points(
            collection_name=collection_name,
            query=query_embedding,
            limit=limit,
            timeout=60,
            score_threshold=threshold,
        )
    except Exception as exc:
        logger.error("Qdrant search error: %s", exc)
        return None

    # docs = filter_chunks(results, threshold=threshold)
    if not results:
        return None

    # Preserve retrieval order; skip duplicate text from overlapping chunks.
    return "\n\n".join([doc.payload.get("text", "") for doc in results.points])

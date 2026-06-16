import logging

from langgraph.config import get_stream_writer
from langgraph.graph import END, StateGraph
from qdrant_client import models

from clients.qdrant import qdrant_client
from ingestion.chunking import chunk_transcript as split_transcript_into_chunks
from ingestion.embedder import generate_embeddings
from utils.youtube import get_transcript
from workflows.states import IngestState

logger = logging.getLogger(__name__)


def _emit_progress(update: dict) -> None:
    writer = get_stream_writer()
    if writer:
        writer(update)


def extract_transcript(state: IngestState) -> IngestState:
    progress = {"status": "Extracting Transcript", "total_chunks": 0, "processed_chunks": 0}
    _emit_progress(progress)

    try:
        transcript = get_transcript(state["video_id"])
        return {**progress, "transcript": transcript, "total_chunks": len(transcript)}
    except Exception as exc:
        logger.exception("Failed to extract transcript for %s", state["video_id"])
        error_msg = (
            "Could not retrieve transcript. The video might not have captions or is restricted."
            if "transcript" in str(exc).lower()
            else "Failed to process the video. Please ensure it has captions and try again."
        )
        return {
            "status": "failed",
            "error": error_msg,
            "completed": True,
        }


def chunk_transcript(state: IngestState) -> IngestState:
    progress = {"status": "Chunking Transcript", "total_chunks": state["total_chunks"], "processed_chunks": 0}
    _emit_progress(progress)

    chunks = split_transcript_into_chunks(state["transcript"])
    return {
        **progress,
        "chunks": chunks,
        "total_chunks": len(chunks),
    }


def embed_and_store(state: IngestState, batch_size: int = 100) -> IngestState:
    chunks = state["chunks"]
    total_chunks = len(chunks)
    collection_name = f"video_{state['video_id'].replace('-', '_')}"

    _emit_progress(
        {
            "status": "Processing Chunks",
            "total_chunks": total_chunks,
            "processed_chunks": 0,
        }
    )

    try:
        if not qdrant_client.collection_exists(collection_name=collection_name):
            qdrant_client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(size=3072, distance=models.Distance.COSINE),
            )

        existing_count = qdrant_client.count(collection_name=collection_name).count
        if existing_count >= total_chunks:
            _emit_progress(
                {
                    "status": "Completed Chunks Processing",
                    "total_chunks": total_chunks,
                    "processed_chunks": existing_count,
                }
            )
            return {
                "status": "Completed Chunks Processing",
                "total_chunks": total_chunks,
                "processed_chunks": existing_count,
                "completed": True,
            }

        for i in range(existing_count, total_chunks, batch_size):
            batch_chunks = chunks[i : i + batch_size]
            texts = [chunk["text"] for chunk in batch_chunks]
            embeddings = generate_embeddings(texts)
            points = [
                models.PointStruct(
                    id=i + j,
                    vector=embedding,
                    payload={"text": batch_chunks[j]["text"]},
                )
                for j, embedding in enumerate(embeddings)
            ]

            qdrant_client.upload_points(
                collection_name=collection_name,
                points=points,
                wait=True,
            )

            processed = i + len(batch_chunks)
            _emit_progress(
                {
                    "status": "Processing...",
                    "total_chunks": total_chunks,
                    "processed_chunks": processed,
                }
            )

        _emit_progress(
            {
                "status": "Completed Processing",
                "total_chunks": total_chunks,
                "processed_chunks": total_chunks,
            }
        )
        return {
            "status": "Completed Processing",
            "total_chunks": total_chunks,
            "processed_chunks": total_chunks,
            "completed": True,
        }
    except Exception:
        logger.exception("Failed to embed/store chunks for %s", state["video_id"])
        error_msg = "An error occurred during embedding processing."
        return {
            "status": "Failed Processing",
            "total_chunks": total_chunks,
            "error": error_msg,
            "completed": True,
        }


def route_after_extract(state: IngestState) -> str:
    if state.get("status") == "failed":
        return "end"
    return "chunk_transcript"


def build_ingest_graph():
    graph = StateGraph(IngestState)
    graph.add_node("extract_transcript", extract_transcript)
    graph.add_node("chunk_transcript", chunk_transcript)
    graph.add_node("embed_and_store", embed_and_store)

    graph.set_entry_point("extract_transcript")
    graph.add_conditional_edges(
        "extract_transcript",
        route_after_extract,
        {"end": END, "chunk_transcript": "chunk_transcript"},
    )
    graph.add_edge("chunk_transcript", "embed_and_store")
    graph.add_edge("embed_and_store", END)

    return graph.compile()

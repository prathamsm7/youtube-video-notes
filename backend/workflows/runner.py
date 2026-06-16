import json
from collections.abc import Iterator

from workflows.ingest_graph import build_ingest_graph
from workflows.query_graph import build_query_graph
from workflows.states import IngestState, QueryState

ingest_graph = build_ingest_graph()
query_graph = build_query_graph()


def stream_ingest_events(video_id: str) -> Iterator[str]:
    """Run the ingest workflow and yield SSE-formatted progress events."""
    initial_state: IngestState = {"video_id": video_id, "status": "extracting"}

    for mode, payload in ingest_graph.stream(
        initial_state,
        stream_mode=["custom", "updates"],
    ):
        if mode == "custom":
            event = {"type": "progress", **payload}
            yield f"data: {json.dumps(event)}\n\n"
            continue

        for _node_name, update in payload.items():
            if not update:
                continue

            if update.get("status") == "failed":
                yield f"data: {json.dumps({'type': 'error', **update})}\n\n"
                return

            if update.get("status"):
                yield f"data: {json.dumps({'type': 'progress', **update})}\n\n"

            if update.get("completed"):
                yield f"data: {json.dumps({'type': 'complete', 'video_id': video_id, **update})}\n\n"
                return

    yield f"data: {json.dumps({'type': 'complete', 'video_id': video_id, 'status': 'completed'})}\n\n"


def run_query(
    video_id: str,
    query: str,
    chat_history: list | None = None,
    cached_summary: str | None = None,
) -> QueryState:
    initial_state: QueryState = {
        "video_id": video_id,
        "query": query,
        "chat_history": chat_history or [],
        "cached_summary": cached_summary,
    }
    return query_graph.invoke(initial_state)

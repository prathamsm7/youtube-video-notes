from typing import Any, TypedDict


class IngestState(TypedDict, total=False):
    video_id: str
    status: str
    transcript: list[dict]
    chunks: list[dict]
    total_chunks: int
    processed_chunks: int
    error: str | None
    completed: bool


class QueryState(TypedDict, total=False):
    video_id: str
    query: str
    chat_history: list
    cached_summary: str | None
    filter_message: str | None
    intent: str
    search_query: str
    context: str
    response: str
    response_stream: Any
    summary_generated: bool
    error: str | None

import json
import logging
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from utils.youtube import get_video_title
from workflows.runner import SUMMARY_META_MARKER, stream_ingest_events, stream_query_response

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="YouTube RAG (LangGraph Workflows)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: str
    content: str


class VideoRequest(BaseModel):
    youtube_url: str


class AskRequest(BaseModel):
    question: str
    video_id: str
    chat_history: Optional[List[Message]] = []
    cached_summary: Optional[str] = None


def extract_video_id(url: str) -> str:
    match = re.search(r"(?:v=|/)([0-9A-Za-z_-]{11}).*", url)
    return match.group(1) if match else url


@app.post("/process_video/stream")
async def process_video_stream(request: VideoRequest):
    """Stream ingest workflow progress via Server-Sent Events."""
    try:
        video_id = extract_video_id(request.youtube_url)
        title = get_video_title(video_id)

        def event_stream():
            yield f"data: {json.dumps({'type': 'started', 'video_id': video_id, 'title': title})}\n\n"
            try:
                for event in stream_ingest_events(video_id):
                    yield event
            except Exception:
                logger.exception("Ingest workflow failed for %s", video_id)
                yield f"data: {json.dumps({'type': 'error', 'video_id': video_id, 'error': 'Failed to process the video. Please try again.'})}\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception:
        logger.exception("Error starting ingest stream for %s", request.youtube_url)
        raise HTTPException(
            status_code=500,
            detail="Failed to start video processing. Please check the URL and try again.",
        )


@app.post("/ask")
async def ask_question(request: AskRequest):
    def iter_result():
        try:
            for kind, payload in stream_query_response(
                request.video_id,
                request.question,
                request.chat_history,
                request.cached_summary,
            ):
                if kind == "token":
                    yield payload
                elif kind == "meta":
                    if payload.get("intent") == "SUMMARY":
                        yield SUMMARY_META_MARKER + json.dumps(
                            {"type": "summary", "summary_generated": payload.get("summary_generated", False)}
                        )
        except Exception:
            logger.exception("Error answering question for video %s", request.video_id)
            yield "An error occurred while generating the response. Please try again."

    return StreamingResponse(iter_result(), media_type="text/plain; charset=utf-8")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

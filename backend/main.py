import re
import logging


from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Message(BaseModel):
    role: str
    content: str

from rag.service import process_and_store_video, process_query, qdrant_client, get_job_status
from utils.youtube import get_video_title

app = FastAPI(title="YouTube RAG (AI Focused)")

# In the new architecture, only Next.js calls Python. 
# We specify the Next.js server as the only allowed origin if we want strict security.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoRequest(BaseModel):
    youtube_url: str

class AskRequest(BaseModel):
    question: str
    video_id: str
    chat_history: Optional[List[Message]] = []

def extract_video_id(url: str) -> str:
    match = re.search(r"(?:v=|/)([0-9A-Za-z_-]{11}).*", url)
    return match.group(1) if match else url

@app.post("/process_video")
async def process_video(request: VideoRequest, background_tasks: BackgroundTasks):
    try:
        video_id = extract_video_id(request.youtube_url)
        title = get_video_title(video_id)
        
        # Check if already fully processed
        try:
            job_status = get_job_status(video_id)
            if job_status and job_status.get("status") == "completed":
                return {
                    "status": "success", 
                    "video_id": video_id, 
                    "title": title,
                    "message": "Already processed"
                }
        except Exception:
            pass 
        
        # Send processing to the background immediately to avoid timeout
        background_tasks.add_task(process_and_store_video, video_id)
        
        return {
            "status": "processing_started", 
            "video_id": video_id, 
            "title": title,
            "message": "Processing started in background."
        }
    except Exception as e:
        logger.exception(f"Error starting video process for {request.youtube_url}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to start video processing. Please check the URL and try again."
        )

@app.get("/status/{video_id}")
async def check_status(video_id: str):
    job_status = get_job_status(video_id)
    if not job_status:
        return {"status": "unknown", "message": "No job found. It may be expired or never started."}
    return job_status

@app.post("/ask")
async def ask_question(request: AskRequest):
    try:
        # Auth and persistence are now handled by Next.js. 
        # Next.js calls this endpoint independently.
        result = process_query(request.video_id, request.question, request.chat_history)
        
        def iter_result():
            if isinstance(result, str):
                yield result
            else:
                for chunk in result:
                    yield chunk

        return StreamingResponse(iter_result(), media_type="text/plain")
    except Exception as e:
        logger.exception(f"Error answering question for video {request.video_id}")
        raise HTTPException(
            status_code=500, 
            detail="An error occurred while generating the response. Please try again."
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

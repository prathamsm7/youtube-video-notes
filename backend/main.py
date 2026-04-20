import re


import asyncio
from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

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
        print(f"Error starting video process: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
        print(f"Error answering question: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/status/{video_id}")
async def websocket_status(websocket: WebSocket, video_id: str):
    await websocket.accept()
    try:
        last_status = None
        while True:
            current_status = get_job_status(video_id)
            if current_status and current_status != last_status:
                await websocket.send_json(current_status)
                last_status = current_status
                
                # Close connection if job is fully done or failed
                status_str = current_status.get("status")
                if status_str in ["completed", "failed"]:
                    break
                    
            await asyncio.sleep(1) # Poll every 1 second server-side
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for {video_id}")
    except Exception as e:
        print(f"WebSocket error for {video_id}: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

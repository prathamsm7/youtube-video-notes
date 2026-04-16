import re


from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag.service import process_and_store_video, process_query, qdrant_client
from utils.youtube import get_transcript, get_video_title

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

def extract_video_id(url: str) -> str:
    match = re.search(r"(?:v=|/)([0-9A-Za-z_-]{11}).*", url)
    return match.group(1) if match else url

@app.post("/process_video")
async def process_video(request: VideoRequest):
    try:
        video_id = extract_video_id(request.youtube_url)
        title = get_video_title(video_id)
        
        try:
            # Check if already processed in Qdrant
            collection_name = f"video_{video_id.replace('-', '_')}"
            if qdrant_client.collection_exists(collection_name=collection_name):
                # Check if it has points
                count_result = qdrant_client.count(collection_name=collection_name)
                if count_result.count > 0:
                    return {
                        "status": "success", 
                        "video_id": video_id, 
                        "title": title,
                        "message": "Already processed"
                    }
        except Exception:
            pass 

        transcript = get_transcript(video_id)
        process_and_store_video(video_id, transcript)
        return {
            "status": "success", 
            "video_id": video_id, 
            "title": title,
            "message": "Processed successfully"
        }
    except Exception as e:
        print(f"Error processing video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ask")
async def ask_question(request: AskRequest):
    try:
        # Auth and persistence are now handled by Next.js. 
        # Next.js calls this endpoint independently.
        answer = process_query(request.video_id, request.question)
        return {
            "question": request.question,
            "answer": answer,
            "status": "success"
        }
    except Exception as e:
        print(f"Error answering question: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

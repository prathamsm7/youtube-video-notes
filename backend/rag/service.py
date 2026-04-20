import os
import json
from google import genai
from dotenv import load_dotenv
from qdrant_client import QdrantClient, models
from tenacity import retry, wait_exponential, stop_after_attempt
from upstash_redis import Redis
from utils.youtube import get_transcript

from langchain_text_splitters import RecursiveCharacterTextSplitter
from rag.router import rule_based_filter, classify_intent, rewrite_query
from utils.ai_handler import generate_with_fallback, stream_with_fallback
load_dotenv()
client = genai.Client()

REDIS_URL = os.environ.get("UPSTASH_REDIS_REST_URL")
REDIS_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
if REDIS_URL and REDIS_TOKEN:
    redis_client = Redis(url=REDIS_URL, token=REDIS_TOKEN)
else:
    redis_client = None

def update_job_status(video_id: str, status: str, total_chunks: int = 0, processed_chunks: int = 0, error: str = None):
    if not redis_client:
        return
    job_key = f"job:{video_id}"
    data = {"status": status, "total_chunks": total_chunks, "processed_chunks": processed_chunks}
    if error:
        data["error"] = error
    redis_client.set(job_key, json.dumps(data), ex=172800) # 48 hours expiry

def get_job_status(video_id: str):
    if not redis_client:
        return None
    job_key = f"job:{video_id}"
    data = redis_client.get(job_key)
    if data:
        try:
            return json.loads(data)
        except:
            return data
    return None

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")

if not all([QDRANT_URL, QDRANT_API_KEY]):
    raise RuntimeError(
        "Missing required env vars: QDRANT_URL, QDRANT_API_KEY. "
        "Please set them in your .env file."
    )

# Connect to Qdrant Cloud with a generous timeout for stability
qdrant_client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY,
    timeout=60, # Increase timeout to 60 seconds
)

import re as _re

def _group_snippets_into_sentences(transcript: list[dict]) -> list[dict]:
    """Group transcript snippets into sentence-level units.

    For transcripts WITH punctuation (manual captions):
        Accumulates snippets until a sentence-ending character (. ? !) is found.
    For transcripts WITHOUT punctuation (auto-generated captions):
        Uses pauses between snippets (>0.8s gap) OR groups of ~8 snippets
        as natural sentence boundaries.
    """
    if not transcript:
        return []

    # Detect if transcript has punctuation (check first 30 snippets)
    sample = " ".join(e["text"] for e in transcript[:30])
    has_punctuation = bool(_re.search(r'[.!?]', sample))

    sentences: list[dict] = []
    current_text = ""
    current_start = transcript[0]["start"]
    current_end = transcript[0]["end"]
    snippet_count = 0

    for i, entry in enumerate(transcript):
        text = entry["text"].strip()
        if not text:
            continue

        start = entry["start"]
        end = entry["end"]

        if not current_text:
            current_start = start

        current_text += (" " if current_text else "") + text
        current_end = end
        snippet_count += 1

        # Decide if this is a sentence boundary
        is_boundary = False

        if has_punctuation:
            # Punctuation-based: sentence ends when text ends with . ? !
            is_boundary = bool(_re.search(r'[.!?]\s*$', text))
        else:
            # Auto-captions: use pause detection or snippet count
            next_start = transcript[i + 1]["start"] if i + 1 < len(transcript) else None
            gap = (next_start - end) if next_start is not None else 999
            is_boundary = gap > 0.8 or snippet_count >= 8

        if is_boundary and current_text:
            sentences.append({
                "text": current_text.strip(),
                "start": current_start,
                "end": current_end,
            })
            current_text = ""
            snippet_count = 0

    # Flush remaining text
    if current_text.strip():
        sentences.append({
            "text": current_text.strip(),
            "start": current_start,
            "end": current_end,
        })

    return sentences


def semantic_chunk_transcript(
    transcript: list[dict],
    max_chars: int = 1000,
    overlap_sentences: int = 2,
) -> list[dict]:
    """Chunk transcript into semantically coherent pieces.

    1. Groups raw snippets into sentence-level units
    2. Packs sentences into chunks of ~max_chars
    3. Overlaps by `overlap_sentences` sentences for context continuity

    Args:
        transcript: List of {text, start, end} from YouTube.
        max_chars: Target max characters per chunk (~1000 = ~150 words ≈ 1 min of speech).
        overlap_sentences: Number of sentences to carry over into the next chunk.
    """
    sentences = _group_snippets_into_sentences(transcript)
    if not sentences:
        return []

    chunks = []
    i = 0

    while i < len(sentences):
        chunk_text = ""
        chunk_start = sentences[i]["start"]
        chunk_end = sentences[i]["end"]
        j = i

        # Pack sentences until we hit the target size
        while j < len(sentences):
            candidate = (chunk_text + " " + sentences[j]["text"]).strip() if chunk_text else sentences[j]["text"]

            # Allow the first sentence even if it exceeds max_chars
            if chunk_text and len(candidate) > max_chars:
                break

            chunk_text = candidate
            chunk_end = sentences[j]["end"]
            j += 1

        chunks.append({
            "text": chunk_text,
            "start": chunk_start,
            "end": chunk_end,
        })

        # Advance with overlap: step back by overlap_sentences from where we stopped
        next_start = max(i + 1, j - overlap_sentences)
        i = next_start

    return chunks

@retry(wait=wait_exponential(multiplier=1, min=2, max=60), stop=stop_after_attempt(5))
def fetch_embeddings_with_retry(batch_texts):
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=batch_texts,
        config={
            "task_type": "RETRIEVAL_DOCUMENT",
        }
    )
    return [e.values for e in result.embeddings]

def process_and_store_video(video_id: str, batch_size: int = 100):
    """Fetches transcript, chunks it, embeds it and stores it securely."""
    update_job_status(video_id, "extracting")
    transcript = get_transcript(video_id)
    
    update_job_status(video_id, "chunking")
    chunks = semantic_chunk_transcript(transcript)
    collection_name = f"video_{video_id.replace('-', '_')}" 
    
    update_job_status(video_id, "embedding", len(chunks), 0)

    # Ensure collection exists
    if not qdrant_client.collection_exists(collection_name=collection_name):
        qdrant_client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(size=3072, distance=models.Distance.COSINE),
        )
        
    existing_count = qdrant_client.count(collection_name=collection_name).count
    if existing_count >= len(chunks):
        update_job_status(video_id, "completed", len(chunks), existing_count)
        return True
        
    for i in range(existing_count, len(chunks), batch_size):
        batch_chunks = chunks[i:i + batch_size]
        texts = [c["text"] for c in batch_chunks]
        
        try:
            embeddings = fetch_embeddings_with_retry(texts)
            points = [
                models.PointStruct(
                    id=i + j,
                    vector=emb,
                    payload={
                        "text": batch_chunks[j]["text"],
                        "start": batch_chunks[j]["start"],
                        "end": batch_chunks[j]["end"]
                    }
                ) for j, emb in enumerate(embeddings)
            ]
            
            qdrant_client.upload_points(
                collection_name=collection_name,
                points=points,
                wait=True
            )
            update_job_status(video_id, "processing", len(chunks), i + len(batch_chunks))
        except Exception as e:
            print(f"Failed to process batch at {i}: {e}")
            update_job_status(video_id, "failed", len(chunks), i, str(e))
            return False # Stop processing this video
            
    update_job_status(video_id, "completed", len(chunks), len(chunks))
    return True

def filter_chunks(results, threshold=0.7):
    """
    In Qdrant, 'score' for COSINE is similarity (higher is better).
    We use similarity > threshold.
    """
    docs = []
    metas = []
    
    # query_points returns a QueryResponse which might need to be accessed via .points
    points = results.points if hasattr(results, 'points') else results
    
    print(f"Retrieved {len(points)} points from Qdrant")
    
    for hit in points:
        # hit is a ScoredPoint object from qdrant_client
        score = getattr(hit, 'score', 0)
        payload = getattr(hit, 'payload', {})
        
        print(f"embedding similarity: {score}")
        if score >= threshold:
            docs.append(payload.get("text", ""))
            metas.append(payload)
            
    if not docs:
        print(f"WARNING: No chunks passed the similarity threshold of {threshold}")
        
    return docs, metas



def merge_chunks(docs, metas, gap=20):
    if not docs:
        return []
        
    merged = []
    current = {"text": docs[0], "start": metas[0]["start"], "end": metas[0]["end"]}
    for i in range(1, len(docs)):
        if metas[i]["start"] - current["end"] < gap:
            current["text"] += " " + docs[i]
            current["end"] = metas[i]["end"]
        else:
            merged.append(current)
            current = {"text": docs[i], "start": metas[i]["start"], "end": metas[i]["end"]}
    merged.append(current)
    return merged

def format_timestamp(seconds: float):
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"

def map_reduce_summary(video_id: str) -> str:
    transcript = get_transcript(video_id)
    if not transcript:
        return "No transcript available to summarize."
        
    full_text = []
    for entry in transcript:
        ts = format_timestamp(entry['start'])
        full_text.append(f"[{ts}] {entry['text']}")
        
    merged_text = " ".join(full_text)
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=10000, 
        chunk_overlap=500
    )
    chunks = text_splitter.split_text(merged_text)
    
    chunk_summaries = []
    for i, chunk in enumerate(chunks):
        map_prompt = f"""
Summarize the following section of a video transcript. Include the key points, topics discussed, and retain the timestamp references where useful.

Transcript Section:
{chunk}
"""
        summary = generate_with_fallback(
            client=client,
            prompt=map_prompt,
            primary_model="gemini-3.1-flash-lite-preview",
            fallback_model="gemini-2.5-flash",
            config={"temperature": 0.3}
        )
        chunk_summaries.append(summary)
        
    combined_summaries = "\n\n--- Next Section ---\n\n".join(chunk_summaries)
    reduce_prompt = f"""
You are provided with chronological summaries of different sections of a video.
Create a comprehensive, cohesive, and structured final summary of the entire video.
Use headings and bullet points where appropriate, and include key timestamp references.

Chronological Segment Summaries:
{combined_summaries}
"""
    return generate_with_fallback(
        client=client,
        prompt=reduce_prompt,
        primary_model="gemini-3.1-flash-lite-preview",
        fallback_model="gemini-2.5-flash",
        config={"temperature": 0.5}
    )

def process_query(video_id: str, query: str, chat_history: list = None) -> str:
    if chat_history is None:
        chat_history = []
        
    filter_msg = rule_based_filter(query)
    if filter_msg:
        return filter_msg
        
    intent = classify_intent(client, query)
    if intent == "SUMMARY":
        try:
            return map_reduce_summary(video_id)
        except Exception as e:
            print("Error generating summary:", e)
            return "An error occurred while generating the video summary."

    search_query = query
    if chat_history:
        search_query = rewrite_query(client, query, chat_history)

    collection_name = f"video_{video_id.replace('-', '_')}"
    query_embedding = client.models.embed_content(
        model="models/gemini-embedding-001",
        contents=search_query,
        config={
            "task_type": "RETRIEVAL_QUERY"
        }
    )

    print("query embedding dim:", len(query_embedding.embeddings[0].values))
    try:
        results = qdrant_client.query_points(
            collection_name=collection_name,
            query=query_embedding.embeddings[0].values,
            limit=10,
            timeout=60
        )

        print("results", results)
    except Exception as e:
        print(f"Qdrant search error: {e}")
        results = []
    
    docs, metas = filter_chunks(results, threshold=0.6)
    
    if not docs:
        return "The video doesn't contain information about that topic."
        
    pairs = sorted(zip(docs, metas), key=lambda x: x[1]['start'])
    if pairs:
        docs, metas = zip(*pairs)
    else:
        docs, metas = [], []

    print("docs", docs)
    # Reranking is disabled to avoid 429 rate limits and improve latency
    # docs, metas = rerank_chunks(query, docs, metas) 
    merged = merge_chunks(docs, metas)

    context = "\n\n".join([
        f"{c['text']} (from {format_timestamp(c['start'])} to {format_timestamp(c['end'])})"
        for c in merged
    ])
    
    chat_history_str = ""
    if chat_history:
        formatted = []
        for msg in chat_history[-6:]:
            role = msg.role if hasattr(msg, 'role') else (msg.get('role', 'User') if isinstance(msg, dict) else 'User')
            content = msg.content if hasattr(msg, 'content') else (msg.get('content', '') if isinstance(msg, dict) else str(msg))
            formatted.append(f"{role.capitalize()}: {content}")
        chat_history_str = "Chat History:\n" + "\n".join(formatted) + "\n\n"
    
    prompt = f"""
You are an expert teacher experienced in teaching with more than 20 years. Your task is to answer the user query using the context is provided.
Only answer the question dont share any other information(your identity, your role, etc.) to user in answer, only provide answer to the query. 

{chat_history_str}Question:
{query}

Context:
{context}


Instructions:
- Provide step-by-step explanation, use pointers if required or asked for it, else provide short answer in detailed.
- Explain concepts clearly (like teaching a student)
- Do NOT add information not present in context
- If incomplete → say "Partial information available"
- If not sure about answer just say I dont know the answer with the short 1-2 lines.
- Always add the bottomline for answer in 1-2 lines if answer found.

Format:
- Use headings
- Use bullet points
- Add explanation under each point
- Include timestamps where relevant
"""
    return stream_with_fallback(
        client=client,
        prompt=prompt,
        primary_model="gemini-3-flash-preview",
        fallback_model="gemini-2.5-pro",
        config={"temperature": 0.5}
    )

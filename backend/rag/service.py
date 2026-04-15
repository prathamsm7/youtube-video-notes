import os
import chromadb
from google import genai
from dotenv import load_dotenv

load_dotenv()
client = genai.Client()

CHROMA_API_KEY = os.environ.get("CHROMA_API_KEY")
CHROMA_TENANT = os.environ.get("CHROMA_TENANT")
CHROMA_DATABASE = os.environ.get("CHROMA_DATABASE")

if not all([CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE]):
    raise RuntimeError(
        "Missing required env vars: CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE. "
        "Please set them in your .env file."
    )

# Connect explicitly to Official Chroma Cloud
chroma_client = chromadb.CloudClient(
    api_key=CHROMA_API_KEY,
    tenant=CHROMA_TENANT,
    database=CHROMA_DATABASE
)

def semantic_chunk_transcript(transcript: list[dict], max_chars=3000, overlap_chars=100) -> list[dict]:
    chunks = []
    current_text = ""
    current_start = None
    current_end = None

    for entry in transcript:
        text = entry["text"].strip()
        start = entry["start"]
        end = entry["end"]

        if current_start is None:
            current_start = start

        current_text += " " + text
        current_end = end

        if len(current_text) >= max_chars:
            chunks.append({
                "text": current_text.strip(),
                "start": current_start,
                "end": current_end
            })
            overlap_text = current_text[-overlap_chars:]
            current_text = overlap_text
            current_start = start

    if current_text:
        chunks.append({
            "text": current_text.strip(),
            "start": current_start,
            "end": current_end
        })

    return chunks

import time

def batch_embed(texts, batch_size=100):
    all_embeddings = []
    # gemini-embedding-001 supports true batching (unlike embedding-2-preview)
    # This reduces your daily request quota usage (RPD) significantly.
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        result = client.models.embed_content(
            model="models/gemini-embedding-001",
            contents=batch,
            config={
                "task_type": "RETRIEVAL_DOCUMENT",
            }
        )
        all_embeddings.extend([e.values for e in result.embeddings])
        # Small delay between batches to stay safe on RPM
        if i + batch_size < len(texts):
            time.sleep(1)
            
    return all_embeddings

def process_and_store_video(video_id: str, transcript: list[dict]):
    """Chunks transcript, embeds it and stores it in Chroma collection under video_id."""
    chunks = semantic_chunk_transcript(transcript, max_chars=3000)
    texts = [c["text"] for c in chunks]
    embeddings = batch_embed(texts)
    
    # Store in chroma
    try:
        collection = chroma_client.get_or_create_collection(name=video_id)
    except Exception as e:
        collection = chroma_client.create_collection(name=video_id)
        
    collection.add(
        documents=[c["text"] for c in chunks],
        embeddings=embeddings,
        ids=[f"{video_id}_{i}" for i in range(len(chunks))],
        metadatas=[{"start": c["start"], "end": c["end"]} for c in chunks]
    )
    return True

def filter_chunks(results, threshold=1.3):
    docs = []
    metas = []
    for doc, meta, dist in zip(results["documents"][0], results["metadatas"][0], results["distances"][0]):
        if dist < threshold:
            docs.append(doc)
            metas.append(meta)
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

def process_query(video_id: str, query: str) -> str:
    collection = chroma_client.get_collection(name=video_id)
    query_embedding = client.models.embed_content(
        model="models/gemini-embedding-001",
        contents=query,
        config={
            "task_type": "RETRIEVAL_QUERY"
        }
    )

    print("query embedding dim:", len(query_embedding.embeddings[0].values))
    results = collection.query(
        query_embeddings=[query_embedding.embeddings[0].values],
        n_results=5 # Reduced to 5 for better prompt fitting
    )
    
    docs, metas = filter_chunks(results, threshold=1.3)
    # Reranking is disabled to avoid 429 rate limits and improve latency
    # docs, metas = rerank_chunks(query, docs, metas) 
    merged = merge_chunks(docs, metas)
    
    def format_timestamp(seconds: float):
        seconds = int(seconds)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        return f"{minutes:02d}:{secs:02d}"

    context = "\n\n".join([
        f"{c['text']} (from {format_timestamp(c['start'])} to {format_timestamp(c['end'])})"
        for c in merged
    ])
    
    prompt = f"""
You are an expert teacher experienced in teaching with more than 20 years. Your task is to answer the user query using the context is provided.
Only answer the question dont share any other information(your identity, your role, etc.) to user in answer, only provide answer to the query. 

Question:
{query}

Context:
{context}


Instructions:
- Provide step-by-step explanation, use pointers if required or asked for it, else provide short answer in detailed.
- Explain concepts clearly (like teaching a student)
- Do NOT add information not present in context
- If incomplete → say "Partial information available"
- If not sure about answer just say I dont know the answer with the short 1-2 lines.
- Max words in answer should be 1900 words strictly including the timestamps and all other formatting symbols.

Format:
- Use headings
- Use bullet points
- Add explanation under each point
- Include timestamps where relevant
"""
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
        config={
            "temperature": 0.5,
        }
    )
    return response.text

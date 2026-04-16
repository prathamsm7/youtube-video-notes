import os
from google import genai
from dotenv import load_dotenv
from qdrant_client import QdrantClient, models

load_dotenv()
client = genai.Client()

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

import time

def batch_embed(texts, batch_size=100):
    all_embeddings = []
    # gemini-embedding-001 supports true batching (unlike embedding-2-preview)
    # This reduces your daily request quota usage (RPD) significantly.
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=batch,
            config={
                "task_type": "RETRIEVAL_DOCUMENT",
            }
        )
        all_embeddings.extend([e.values for e in result.embeddings])
        print(len(all_embeddings))
        # Small delay between batches to stay safe on RPM
        # if i + batch_size < len(texts):
        #     time.sleep(1)
            
    return all_embeddings

def process_and_store_video(video_id: str, transcript: list[dict]):
    """Chunks transcript, embeds it and stores it in Qdrant collection under video_id."""
    chunks = semantic_chunk_transcript(transcript)
    print(f"Chunks: {len(chunks)}")
    texts = [c["text"] for c in chunks]
    embeddings = batch_embed(texts)
    
    # Qdrant collection names can't contain certain characters, but YouTube IDs are safe
    collection_name = f"video_{video_id.replace('-', '_')}" 

    # Ensure collection exists
    if not qdrant_client.collection_exists(collection_name=collection_name):
        qdrant_client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(size=3072, distance=models.Distance.COSINE),
        )
        
    points = [
        models.PointStruct(
            id=i,
            vector=emb,
            payload={
                "text": chunks[i]["text"],
                "start": chunks[i]["start"],
                "end": chunks[i]["end"]
            }
        ) for i, emb in enumerate(embeddings)
    ]
    
    qdrant_client.upload_points(
        collection_name=collection_name,
        points=points,
        batch_size=64,     # Smaller batches prevent "Write operation timed out"
        parallel=2,        # Use 2 parallel workers for speed
        wait=True
    )
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

def process_query(video_id: str, query: str) -> str:
    collection_name = f"video_{video_id.replace('-', '_')}"
    query_embedding = client.models.embed_content(
        model="models/gemini-embedding-001",
        contents=query,
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
        # Fallback to empty results if collection doesn't exist or other error
        results = []
    
    docs, metas = filter_chunks(results, threshold=0.6) # Similarity threshold for Qdrant
    
    # Sort chunks chronologically before merging to fix timestamp issues
    pairs = sorted(zip(docs, metas), key=lambda x: x[1]['start'])
    if pairs:
        docs, metas = zip(*pairs)
    else:
        docs, metas = [], []

    print("docs", docs)
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
- Always add the bottomline for answer in 1-2 lines if answer found.

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

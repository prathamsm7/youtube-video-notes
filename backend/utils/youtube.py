import os
import logging
import requests
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound
from youtube_transcript_api.proxies import WebshareProxyConfig

logger = logging.getLogger(__name__)

def get_video_title(video_id: str) -> str:
    """Fetch video title using YouTube oEmbed API."""
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        response = requests.get(url, timeout=3)
        if response.status_code == 200:
            return response.json().get("title", f"Video {video_id}")
    except Exception:
        pass
    return f"Video {video_id}"

def _get_transcript_supadata(video_id: str) -> list[dict]:
    """Fetch transcript via Supadata API (handles IP blocks on their end)."""
    api_key = os.environ.get("SUPADATA_API_KEY")
    if not api_key:
        raise RuntimeError("SUPADATA_API_KEY not set.")

    logger.info(f"[Supadata] Requesting transcript for video_id={video_id}")
    resp = requests.get(
        "https://api.supadata.ai/v1/transcript",
        params={
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "lang": "en",
            "text": "false",  # Get timestamped chunks
        },
        headers={"x-api-key": api_key},
        timeout=30,
    )
    logger.info(f"[Supadata] Response status: {resp.status_code} for video_id={video_id}")
    resp.raise_for_status()
    data = resp.json()

    detected_lang = data.get("lang", "unknown")
    available_langs = data.get("availableLangs", [])
    chunks = data.get("content", [])

    logger.info(
        f"[Supadata] video_id={video_id} | lang={detected_lang} | "
        f"available_langs={available_langs} | chunks={len(chunks)}"
    )

    if not chunks:
        raise ValueError("No transcript content returned by Supadata.")

    full_transcript = []
    for chunk in chunks:
        start_ms = chunk.get("offset", 0)
        duration_ms = chunk.get("duration", 0)
        start = start_ms / 1000.0
        duration = duration_ms / 1000.0
        full_transcript.append({
            "text": chunk.get("text", ""),
            "start": start,
            "end": start + duration,
        })

    logger.info(f"[Supadata] Successfully fetched {len(full_transcript)} segments for video_id={video_id}")
    return full_transcript

def _get_transcript_ytt(video_id: str) -> list[dict]:
    """Fetch transcript via youtube-transcript-api with optional Webshare proxy."""
    proxy_username = os.environ.get("WEBSHARE_PROXY_USERNAME")
    proxy_password = os.environ.get("WEBSHARE_PROXY_PASSWORD")

    if proxy_username and proxy_password:
        logger.info(f"[YTT] Using WebshareProxyConfig (rotating residential) for video_id={video_id}")
        proxy_config = WebshareProxyConfig(
            proxy_username=proxy_username,
            proxy_password=proxy_password,
        )
        ytt_api = YouTubeTranscriptApi(proxy_config=proxy_config)
    else:
        logger.info(f"[YTT] No proxy configured — using direct connection for video_id={video_id}")
        ytt_api = YouTubeTranscriptApi()

    transcript_list = ytt_api.list(video_id)

    try:
        transcript = transcript_list.find_transcript(["en", "en-US"]).fetch()
        logger.info(f"[YTT] Found English transcript for video_id={video_id}")
    except NoTranscriptFound:
        available = list(transcript_list)
        if not available:
            raise ValueError("No transcript available for this video.")
        lang = available[0].language_code if hasattr(available[0], "language_code") else "unknown"
        logger.info(f"[YTT] No EN transcript — using fallback lang={lang} for video_id={video_id}")
        transcript = available[0].fetch()

    full_transcript = []
    for snippet in transcript:
        text = snippet["text"] if isinstance(snippet, dict) else snippet.text
        start = snippet["start"] if isinstance(snippet, dict) else snippet.start
        duration = snippet["duration"] if isinstance(snippet, dict) else snippet.duration
        full_transcript.append({
            "text": text,
            "start": start,
            "end": start + duration,
        })

    logger.info(f"[YTT] Successfully fetched {len(full_transcript)} segments for video_id={video_id}")
    return full_transcript

def get_transcript(video_id: str) -> list[dict]:
    """Fetch transcript: tries Supadata first, falls back to youtube-transcript-api.

    Supadata handles YouTube IP blocks on their infrastructure, making it reliable
    on cloud platforms like Render. youtube-transcript-api is kept as a fallback
    for when a Webshare proxy is configured.
    """
    supadata_key = os.environ.get("SUPADATA_API_KEY")

    if supadata_key:
        logger.info(f"[Transcript] SUPADATA_API_KEY detected — trying Supadata for video_id={video_id}")
        try:
            return _get_transcript_supadata(video_id)
        except Exception as e:
            logger.warning(
                f"[Transcript] Supadata failed for video_id={video_id}: {e}. "
                f"Falling back to youtube-transcript-api."
            )
    else:
        logger.info(f"[Transcript] No SUPADATA_API_KEY — using youtube-transcript-api directly for video_id={video_id}")

    return _get_transcript_ytt(video_id)

import os
import requests
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound
from youtube_transcript_api.proxies import WebshareProxyConfig

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

def get_transcript(video_id: str) -> list[dict]:
    """Robust transcript fetch: prefer en/en-US, else fallback to any.
    
    Uses WebshareProxyConfig if WEBSHARE_PROXY_USERNAME and WEBSHARE_PROXY_PASSWORD
    are set, which enables rotating residential IPs and auto-retry on IP blocks.
    """
    proxy_username = os.environ.get("WEBSHARE_PROXY_USERNAME")
    proxy_password = os.environ.get("WEBSHARE_PROXY_PASSWORD")

    if proxy_username and proxy_password:
        # WebshareProxyConfig uses rotating residential IPs and retries up to 10x
        # when blocked — far more reliable than a static/generic proxy.
        proxy_config = WebshareProxyConfig(
            proxy_username=proxy_username,
            proxy_password=proxy_password,
        )
        ytt_api = YouTubeTranscriptApi(proxy_config=proxy_config)
    else:
        ytt_api = YouTubeTranscriptApi()

    transcript_list = ytt_api.list(video_id)

    try:
        transcript = transcript_list.find_transcript(["en", "en-US"]).fetch()
    except NoTranscriptFound:
        available = list(transcript_list)
        if not available:
            raise ValueError("No transcript available for this video.")
        transcript = available[0].fetch()

    # Normalize response output
    full_transcript = []
    for snippet in transcript:
        text = snippet["text"] if isinstance(snippet, dict) else snippet.text
        start = snippet["start"] if isinstance(snippet, dict) else snippet.start
        duration = snippet["duration"] if isinstance(snippet, dict) else snippet.duration
        full_transcript.append({
            "text": text,
            "start": start,
            "end": start + duration
        })
    return full_transcript

import requests
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound

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
    """Robust transcript fetch: prefer en/en-US, else fallback to any."""
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

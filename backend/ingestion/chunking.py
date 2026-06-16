WINDOW_SECONDS = 300  # 5 minutes
OVERLAP_RATIO = 0.20
STEP_SECONDS = WINDOW_SECONDS * (1 - OVERLAP_RATIO)  # 240s — 20% overlap


def chunk_transcript(transcript: list[dict]) -> list[dict]:
    """Merge transcript snippets into 5-minute windows with 20% overlap.

    Uses snippet timestamps only to decide window boundaries.
    Each chunk contains text only (no start/end stored).
    """
    if not transcript:
        return []

    window_start = transcript[0]["start"]
    video_end = transcript[-1]["end"]
    chunks: list[dict] = []

    while window_start < video_end:
        window_end = window_start + WINDOW_SECONDS

        parts = [
            entry["text"].strip()
            for entry in transcript
            if entry["start"] >= window_start and entry["start"] < window_end
        ]

        if parts:
            chunks.append({"text": " ".join(parts)})

        window_start += STEP_SECONDS

    return chunks

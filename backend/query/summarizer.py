from clients.gemini import client
from query.retrieval import get_all_chunks
from utils.ai_handler import generate_with_fallback


def _summarize_chunk(chunk_text: str, index: int) -> str:
    map_prompt = f"""
                    You are an expert content summarizer. Your task is to summerise given transcript section in concise and to the point manner.
                    Summarize the following section (part {index + 1}) of a  video transcript.
                    Include the key points and topics discussed.
                    Keep the summary concise and to the point.
                    Maintain original tone and style of the transcript.
                    Do not add any extra information or commentary.


                    Transcript Section:
                    {chunk_text}
                """
    return generate_with_fallback(
        client=client,
        prompt=map_prompt,
        primary_model="gemini-3.1-flash-lite-preview",
        fallback_model="gemini-2.5-flash",
        config={"temperature": 0.1},
    )


def map_reduce_summary(video_id: str) -> str:
    chunks = get_all_chunks(video_id)
    if not chunks:
        return "No indexed content available to summarize. Please process the video first."

    chunk_summaries = [_summarize_chunk(text, i) for i, text in enumerate(chunks)]

    combined_summaries = "\n\n--- Next Section ---\n\n".join(chunk_summaries)
    reduce_prompt = f"""
                        You are provided with chronological summaries of different sections of a video.
                        Create a comprehensive, cohesive, and structured final summary of the entire video.
                        Use headings and bullet points where appropriate.
                        Do not add any extra information or commentary.
                        Maintain original tone and style of the transcript.
                        

                        Chronological Segment Summaries:
                        {combined_summaries}
                    """
    return generate_with_fallback(
        client=client,
        prompt=reduce_prompt,
        primary_model="gemini-3.1-flash-lite-preview",
        fallback_model="gemini-2.5-flash",
        config={"temperature": 0.1},
    )

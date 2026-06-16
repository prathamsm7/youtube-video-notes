import json
import logging
import re

from utils.ai_handler import generate_with_fallback

logger = logging.getLogger(__name__)


def rule_based_filter(query: str) -> str | None:
    """Reject very short or conversational queries."""
    q = query.strip()

    if len(q) < 3:
        return "This query is too short. Please ask a specific question about the video."

    conversational_patterns = [
        r"^(hi|hello|hey|test|testing)$",
        r"^(how are you|what is up).*",
    ]

    for pattern in conversational_patterns:
        if re.match(pattern, q, re.IGNORECASE):
            return "This query is too short or conversational. Please ask a specific question about the video."

    return None


def _format_chat_history(chat_history: list) -> str:
    lines = []
    for msg in chat_history[-6:]:
        role = (
            msg.role
            if hasattr(msg, "role")
            else (msg.get("role", "User") if isinstance(msg, dict) else "User")
        )
        content = (
            msg.content
            if hasattr(msg, "content")
            else (msg.get("content", "") if isinstance(msg, dict) else str(msg))
        )
        lines.append(f"{role.capitalize()}: {content}")
    return "\n".join(lines)


def analyze_query(client, query: str, chat_history: list | None = None) -> dict:
    """Classify intent and produce a search query in one LLM call."""
    chat_history = chat_history or []
    history_str = _format_chat_history(chat_history)
    history_block = (
        f"Chat History:\n{history_str}\n\n" if history_str else "Chat History: (none)\n\n"
    )

    prompt = f"""
                    You are understanding the intent of a user's query and routing it to the appropriate service.

                    {history_block}
                    Latest User Query: {query}

                    Tasks:
                    1. Classify intent as SUMMARY or QA.
                    - SUMMARY: user wants a general overview or summary of the whole video
                    - QA: user asks a specific question that needs retrieval from the video

                    2. Set search_query for vector search.
                    - If QA: rewrite into a standalone search phrase (use chat history to resolve pronouns)
                    - If SUMMARY: use the latest query as-is

                    Output ONLY valid JSON, no markdown:
                    {{"intent": "SUMMARY" or "QA", "search_query": "..."}}
            """
    try:
        raw = generate_with_fallback(
            client=client,
            prompt=prompt,
            primary_model="gemini-3.1-flash-lite-preview",
            fallback_model="gemini-2.5-flash-lite",
            config={"temperature": 0},
        )
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.removeprefix("```json").removeprefix("```").strip()
            cleaned = cleaned.removesuffix("```").strip()

        data = json.loads(cleaned)
        intent = "SUMMARY" if str(data.get("intent", "")).upper() == "SUMMARY" else "QA"
        search_query = str(data.get("search_query", query)).strip() or query
        return {"intent": intent, "search_query": search_query}
    except Exception as exc:
        logger.warning("Query analysis error: %s", exc)
        return {"intent": "QA", "search_query": query}

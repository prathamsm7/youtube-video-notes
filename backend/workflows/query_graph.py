import logging

from langgraph.config import get_stream_writer
from langgraph.graph import END, StateGraph

from clients.gemini import client
from query.retrieval import retrieve_context
from query.summarizer import map_reduce_summary
from query.router import analyze_query, rule_based_filter
from utils.ai_handler import stream_with_fallback
from workflows.states import QueryState

logger = logging.getLogger(__name__)


def _emit_token(content: str) -> None:
    writer = get_stream_writer()
    if writer:
        writer({"type": "token", "content": content})


def _format_chat_history(chat_history: list) -> str:
    if not chat_history:
        return ""

    formatted = []
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
        formatted.append(f"{role.capitalize()}: {content}")

    return "Chat History:\n" + "\n".join(formatted) + "\n\n"


def filter_query(state: QueryState) -> QueryState:
    filter_message = rule_based_filter(state["query"])
    if filter_message:
        _emit_token(filter_message)
        return {"filter_message": filter_message, "response": filter_message}
    return {"filter_message": None}


def route_after_filter(state: QueryState) -> str:
    if state.get("filter_message"):
        return "end"
    return "analyze_query"


def analyze_query_node(state: QueryState) -> QueryState:
    result = analyze_query(client, state["query"], state.get("chat_history") or [])
    return {"intent": result["intent"], "search_query": result["search_query"]}


def route_after_intent(state: QueryState) -> str:
    if state.get("intent") == "SUMMARY":
        return "summarize"
    return "prepare_rag"


def summarize_video(state: QueryState) -> QueryState:
    cached = (state.get("cached_summary") or "").strip()
    if cached:
        _emit_token(cached)
        return {"response": cached, "intent": "SUMMARY"}

    try:
        summary = map_reduce_summary(state["video_id"])
        _emit_token(summary)
        return {"response": summary, "intent": "SUMMARY", "summary_generated": True}
    except Exception as exc:
        logger.exception("Error generating summary for %s", state["video_id"])
        message = "An error occurred while generating the video summary."
        _emit_token(message)
        return {"response": message, "intent": "SUMMARY", "error": str(exc)}


def prepare_rag(state: QueryState) -> QueryState:
    search_query = state.get("search_query") or state["query"]

    context = retrieve_context(state["video_id"], search_query, 5)
    if not context:
        message = "The video doesn't contain information about that topic."
        _emit_token(message)
        return {"search_query": search_query, "response": message}

    return {"search_query": search_query, "context": context}


def route_after_prepare(state: QueryState) -> str:
    if state.get("context"):
        return "generate_answer"
    return "end"


def generate_answer(state: QueryState) -> QueryState:
    chat_history_str = _format_chat_history(state.get("chat_history") or [])
    prompt = f"""
You are an expert teacher experienced in teaching with more than 20 years. Your task is to answer the user query using the context is provided.
Only answer the question dont share any other information(your identity, your role, etc.) to user in answer, only provide answer to the query.

{chat_history_str}

Latest User Query:
{state["query"]}

Context:
{state["context"]}


Instructions:
- Provide step-by-step explanation, use pointers if required or asked for it, else provide short answer in detailed.
- Explain concepts clearly (like teaching a student)
- Do NOT add information not present in context
- If incomplete → say "Partial information available"
- If not sure about answer just say I dont know the answer with the short 1-2 lines.
- Always add the bottomline for answer in 1-2 lines if answer found.
- Detect the language of "Latest User Query" and always write your entire answer in that language.
- The context may be in Hindi or another language; translate and explain it in the user's language.

Format:
- Use headings
- Use bullet points
- Add explanation under each point
"""
    parts: list[str] = []
    for chunk in stream_with_fallback(
        client=client,
        prompt=prompt,
        primary_model="gemini-3-flash-preview",
        fallback_model="gemini-2.5-pro",
        config={"temperature": 0.5},
    ):
        parts.append(chunk)
        _emit_token(chunk)

    return {"response": "".join(parts), "intent": "QA"}


def build_query_graph():
    graph = StateGraph(QueryState)
    graph.add_node("filter_query", filter_query)
    graph.add_node("analyze_query", analyze_query_node)
    graph.add_node("summarize", summarize_video)
    graph.add_node("prepare_rag", prepare_rag)
    graph.add_node("generate_answer", generate_answer)

    graph.set_entry_point("filter_query")
    graph.add_conditional_edges(
        "filter_query",
        route_after_filter,
        {"end": END, "analyze_query": "analyze_query"},
    )
    graph.add_conditional_edges(
        "analyze_query",
        route_after_intent,
        {"summarize": "summarize", "prepare_rag": "prepare_rag"},
    )
    graph.add_edge("summarize", END)
    graph.add_conditional_edges(
        "prepare_rag",
        route_after_prepare,
        {"generate_answer": "generate_answer", "end": END},
    )
    graph.add_edge("generate_answer", END)

    return graph.compile()

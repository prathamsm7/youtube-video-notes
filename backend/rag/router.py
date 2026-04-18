import re

def rule_based_filter(query: str) -> str | None:
    """
    Checks if the query is too short or just conversational noise.
    Returns an error message if invalid, or None if valid.
    """
    q = query.strip()
    
    # 1. Length check
    if len(q) < 3:
        return "This query is too short. Please ask a specific question about the video."
    
    # 2. Conversational noise check
    conversational_patterns = [
        r'^(hi|hello|hey|test|testing)$',
        r'^(how are you|what is up).*'
    ]
    
    for pattern in conversational_patterns:
        if re.match(pattern, q, re.IGNORECASE):
             return "This query is too short or conversational. Please ask a specific question about the video."
             
    return None

def classify_intent(client, query: str) -> str:
    """
    Given a query, uses the LLM to classify whether it's asking for a full video summary or a specific QA.
    """
    prompt = f"""
Classify the following user query into one of two categories: 'SUMMARY' or 'QA'.

Rules:
If the user is asking for a general overview, summary of the whole video, or what the video is about, output 'SUMMARY'.
If the user is asking a specific question, searching for specific details, or asking anything else requiring specific context retrieval, output 'QA'.

Output ONLY the exact category name in uppercase.

Query: "{query}"
"""
    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
            config={
                "temperature": 0,
            }
        )
        intent = response.text.strip().upper()
        if "SUMMARY" in intent:
            return "SUMMARY"
        return "QA"
    except Exception as e:
        print("Intent classification error:", e)
        return "QA" # Fallback to standard flow

def rewrite_query(client, query: str, chat_history: list) -> str:
    """
    Rewrites a user query into a standalone search term by resolving pronouns/references 
    against the provided chat history.
    """
    if not chat_history:
        return query
    
    formatted_history = ""
    for msg in chat_history:
        role = msg.role if hasattr(msg, 'role') else (msg.get('role', '') if isinstance(msg, dict) else 'User')
        content = msg.content if hasattr(msg, 'content') else (msg.get('content', '') if isinstance(msg, dict) else str(msg))
        formatted_history += f"{role.capitalize()}: {content}\n"

    prompt = f"""
Based on the following chat history, rewrite the user's latest query as a standalone search statement that requires no prior context to understand.
If the query is already standalone or doesn't need rewriting, output it as-is.
Do not answer the query, only rewrite it.

Chat History:
{formatted_history}

Latest Query: {query}
"""
    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
            config={
                "temperature": 0.2, 
            }
        )
        return response.text.strip()
    except Exception as e:
        print("Query rewrite error:", e)
        return query

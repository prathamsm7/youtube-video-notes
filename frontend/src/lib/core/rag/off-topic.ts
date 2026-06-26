const OFF_TOPIC_PATTERNS = [
  /^(hi|hello|hey|howdy|hiya|yo|sup)$/,
  /^good\s+(morning|afternoon|evening|night)$/,
  /^how\s+are\s+you(\s+doing)?$/,
  /^how('s| is)\s+it\s+going$/,
  /^what('s| is)\s+up$/,
  /^how\s+do\s+you\s+do$/,
  /^(thanks?|thank\s+you|thx|ty)$/,
  /^(ok(ay)?|cool|nice|great|awesome|got\s+it|understood)$/,
  /^(who|what)\s+are\s+you$/,
  /^nice\s+to\s+meet\s+you$/,
  /^(good)?bye$/,
  /^see\s+you$/,
  /^(lol|haha+)$/,
];

function normalizeForMatch(query: string): string {
  return query.trim().replace(/[!?.]+$/, "").trim().toLowerCase();
}

/** Social / vague queries that should not trigger retrieval. */
export function isOffTopicQuery(query: string): boolean {
  const normalized = normalizeForMatch(query);
  if (!normalized) return true;
  return OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildOffTopicResponse(
  query: string,
  language: string,
  sourceLabel: "video" | "document",
): string {
  const normalized = normalizeForMatch(query);
  const isHindi = language === "Hindi";
  const sourceNoun = sourceLabel === "video" ? "video" : "document";
  const hindiSourceNoun = sourceLabel === "video" ? "वीडियो" : "दस्तावेज़";

  if (/^(thanks?|thank\s+you|thx|ty)$/.test(normalized)) {
    return isHindi
      ? `आपका स्वागत है! इस ${hindiSourceNoun} के बारे में कोई और सवाल हो तो पूछिए।`
      : `You're welcome! Let me know if you have any other questions about this ${sourceNoun}.`;
  }

  if (
    /^(hi|hello|hey|howdy|hiya|yo|sup|good\s+(morning|afternoon|evening|night))$/.test(
      normalized,
    ) ||
    /^how\s+are\s+you(\s+doing)?$/.test(normalized) ||
    /^how('s| is)\s+it\s+going$/.test(normalized) ||
    /^what('s| is)\s+up$/.test(normalized)
  ) {
    return isHindi
      ? `मैं ठीक हूँ, धन्यवाद! मैं इस ${hindiSourceNoun} से संबंधित सवालों में आपकी मदद कर सकता हूँ।`
      : `I'm doing well, thank you! I'm here to help you with questions about this ${sourceNoun}. What would you like to know?`;
  }

  return isHindi
    ? `मैं इस ${hindiSourceNoun} से संबंधित सवालों में आपकी मदद कर सकता हूँ। कृपया सामग्री के बारे में कोई विशिष्ट सवाल पूछें।`
    : `I'm here to help you with questions about this ${sourceNoun}. Please ask a specific question about the content.`;
}

/**
 * Custom LLM-as-judge prompt for context recall.
 *
 * Complements retrieval_relevance (precision): recall measures whether the
 * retrieved chunks contain enough information to support the reference answer.
 */
export const CONTEXT_RECALL_PROMPT = `You are an expert data labeler evaluating retrieval recall for a RAG system. Your task is to score how completely the retrieved context covers the information needed to answer the input question, using the reference answer as the ground truth for what must be retrievable.

<Rubric>
High recall (close to 1.0):
- The retrieved context contains the key facts, entities, and reasoning steps needed to produce the reference answer
- A knowledgeable reader could reconstruct the reference answer from the retrieved chunks alone
- Missing details are minor or non-essential

Low recall (close to 0.0):
- Critical facts from the reference answer are absent from all retrieved chunks
- The context is too narrow, off-topic, or incomplete to support the reference answer
- Important entities, numbers, dates, or causal links from the reference are not present anywhere in retrieval
</Rubric>

<Instruction>
1. Read the input question and reference answer; list the essential information units (facts, claims, steps) required for a complete answer.
2. Search the retrieved context for each unit — count a unit as covered if it appears explicitly or can be clearly inferred from the chunks.
3. Score = (covered essential units) / (total essential units). Use partial credit when a unit is only partly present.
4. Ignore whether the model's final answer was correct; judge retrieval coverage only.
5. Do not penalize extra irrelevant chunks (that is measured by context precision, not recall).
</Instruction>

<Reminder>
- Focus on coverage of reference-answer content, not chunk count or ordering.
- Synonyms and paraphrases count as covered when meaning matches.
- Cite which reference facts were found or missing in your comment.
</Reminder>

<inputs>
{inputs}
</inputs>

<retrieved_context>
{context}
</retrieved_context>

<reference_outputs>
{reference_outputs}
</reference_outputs>
`;

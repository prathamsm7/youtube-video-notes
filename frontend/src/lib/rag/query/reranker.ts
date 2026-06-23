import { RERANKER_MODEL, RETRIEVAL_CHUNK_LIMIT } from "../constants";

const RERANKER_API_URL = "https://api.jina.ai/v1/rerank";

type JinaRerankResult = {
  index: number;
  relevance_score?: number;
  score?: number;
};

export type RerankedItem<T> = {
  item: T;
  rerankScore: number;
};

export async function rerankByRelevance<T>(
  query: string,
  items: T[],
  getDocumentText: (item: T) => string,
  topN = RETRIEVAL_CHUNK_LIMIT,
): Promise<RerankedItem<T>[]> {
  if (!items.length) {
    return [];
  }

  const apiKey = process.env.JINA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("JINA_API_KEY is not configured");
  }

  const documents = items.map(getDocumentText);
  if (!documents.some((document) => document.length > 0)) {
    return [];
  }

  const response = await fetch(RERANKER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: RERANKER_MODEL,
      query,
      documents,
      top_n: Math.min(topN, documents.length),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jina reranker failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { results?: JinaRerankResult[] };

  return (data.results ?? []).map((result) => ({
    item: items[result.index],
    rerankScore: result.relevance_score ?? result.score ?? 0,
  }));
}

import {
  EMBEDDING_API_URL,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_MODEL,
} from "../constants";

type JinaEmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>;
  detail?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey(): string {
  const apiKey = process.env.JINA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("JINA_API_KEY is not configured");
  }
  return apiKey;
}

async function embedTexts(
  texts: string[],
  task: "retrieval.query" | "retrieval.passage",
): Promise<number[][]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(EMBEDDING_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          task,
          input: texts,
        }),
      });

      const body = (await response.json()) as JinaEmbeddingResponse;

      if (!response.ok) {
        const message =
          body.detail ||
          `Jina embedding failed (${response.status})`;
        const error = new Error(message);

        if ((response.status === 429 || response.status === 503) && attempt < 4) {
          lastError = error;
          await sleep(2 ** attempt * 1000);
          continue;
        }

        throw error;
      }

      const embeddings = body.data?.map((item) => item.embedding ?? []) ?? [];
      if (embeddings.length !== texts.length || embeddings.some((v) => !v.length)) {
        throw new Error("Jina returned an incomplete embedding batch");
      }

      return embeddings;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (
        (message.includes("429") || message.includes("503")) &&
        attempt < 4
      ) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      break;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to generate embeddings");
}

export async function generateEmbeddings(batchTexts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < batchTexts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = batchTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const batchEmbeddings = await embedTexts(batch, "retrieval.passage");
    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}

export async function embedQuery(searchQuery: string): Promise<number[]> {
  const [embedding] = await embedTexts([searchQuery], "retrieval.query");
  return embedding;
}

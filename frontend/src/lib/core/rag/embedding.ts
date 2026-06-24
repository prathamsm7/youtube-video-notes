import { OpenAIEmbeddings } from "@langchain/openai";
import {
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from "./constants";

let embeddingsClient: OpenAIEmbeddings | null = null;

function getEmbeddingsClient(): OpenAIEmbeddings {
  if (embeddingsClient) {
    return embeddingsClient;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  embeddingsClient = new OpenAIEmbeddings({
    model: EMBEDDING_MODEL,
    apiKey,
    dimensions: EMBEDDING_DIMENSIONS,
    batchSize: EMBEDDING_BATCH_SIZE,
  });

  return embeddingsClient;
}

export async function generateEmbeddings(batchTexts: string[]): Promise<number[][]> {
  const client = getEmbeddingsClient();
  const embeddings: number[][] = [];

  for (let i = 0; i < batchTexts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = batchTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const batchEmbeddings = await client.embedDocuments(batch);
    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}

export async function embedQuery(searchQuery: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([searchQuery]);
  return embedding;
}

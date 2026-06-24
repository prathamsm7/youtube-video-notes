import { generateWithFallback, stream } from "@/lib/core/ai-handler";
import {
  CHAT_MODEL_FAST,
  CHAT_MODEL_STRONG,
  SUMMARY_MAP_CONCURRENCY,
} from "@/lib/core/rag/constants";
import { getAllChunks } from "./retrieval";

async function summarizeChunk(chunkText: string, index: number): Promise<string> {
  const systemPrompt = `Summarize the following section of a video transcript.
Include the key points and topics discussed. Keep it concise.
Do not add extra information.`;

  const userPrompt = `Section part ${index + 1}:\n\n${chunkText}`;

  return generateWithFallback(
    systemPrompt,
    userPrompt,
    CHAT_MODEL_FAST,
    CHAT_MODEL_STRONG,
    0.1,
  );
}

export async function mapReduceSummary(
  videoId: string,
  language: string,
  onToken?: (token: string) => void,
): Promise<string> {
  const chunks = await getAllChunks(videoId);
  if (!chunks.length) {
    return "No indexed content available to summarize. Please process the video first.";
  }

  const chunkSummaries: string[] = [];

  for (let i = 0; i < chunks.length; i += SUMMARY_MAP_CONCURRENCY) {
    const batch = chunks.slice(i, i + SUMMARY_MAP_CONCURRENCY);
    const batchSummaries = await Promise.all(
      batch.map((chunkText, j) => summarizeChunk(chunkText, i + j)),
    );
    chunkSummaries.push(...batchSummaries);
  }

  const combinedSummaries = chunkSummaries.join("\n\n--- Next Section ---\n\n");

  const systemPrompt = `You are provided with chronological summaries of different sections of a video.
Create a comprehensive, cohesive, and structured final summary of the entire video.
Use headings and bullet points where appropriate.
Do not add extra information.`;

  const userPrompt = `Write the entire summary in ${language} only — even if the transcript segments are in another language.

Chronological Segment Summaries:
${combinedSummaries}`;

  if (onToken) {
    return stream(systemPrompt, userPrompt, CHAT_MODEL_FAST, onToken, 0.1);
  }

  return generateWithFallback(
    systemPrompt,
    userPrompt,
    CHAT_MODEL_FAST,
    CHAT_MODEL_STRONG,
    0.1,
  );
}

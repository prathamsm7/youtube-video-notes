import { generateWithFallback, streamWithFallback } from "../ai-handler";
import { CHAT_MODEL_FAST, CHAT_MODEL_STRONG, SUMMARY_MAP_CONCURRENCY } from "../constants";
import { getAllChunks } from "./retrieval";

async function summarizeChunk(chunkText: string, index: number): Promise<string> {
  const mapPrompt = `
Summarize the following section (part ${index + 1}) of a video transcript.
Include the key points and topics discussed. Keep it concise.
Do not add extra information.

Transcript Section:
${chunkText}
`;

  return generateWithFallback(mapPrompt, CHAT_MODEL_FAST, CHAT_MODEL_STRONG, 0.1);
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
  const reducePrompt = `
You are provided with chronological summaries of different sections of a video.
Create a comprehensive, cohesive, and structured final summary of the entire video.
Use headings and bullet points where appropriate.
Do not add extra information.

Write the entire summary in ${language} only — even if the transcript segments are in another language.

Chronological Segment Summaries:
${combinedSummaries}
`;

  if (onToken) {
    return streamWithFallback(
      reducePrompt,
      CHAT_MODEL_FAST,
      CHAT_MODEL_STRONG,
      onToken,
      0.1,
    );
  }

  return generateWithFallback(reducePrompt, CHAT_MODEL_FAST, CHAT_MODEL_STRONG, 0.1);
}

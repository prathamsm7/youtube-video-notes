import { generateWithFallback } from "../ai-handler";
import { CHAT_MODEL_FAST, CHAT_MODEL_STRONG } from "../constants";
import { getAllChunks } from "./retrieval";

async function summarizeChunk(chunkText: string, index: number): Promise<string> {
  const mapPrompt = `
                    You are an expert content summarizer. Your task is to summerise given transcript section in concise and to the point manner.
                    Summarize the following section (part ${index + 1}) of a  video transcript.
                    Include the key points and topics discussed.
                    Keep the summary concise and to the point.
                    Maintain original tone and style of the transcript.
                    Do not add any extra information or commentary.


                    Transcript Section:
                    ${chunkText}
                `;

  return generateWithFallback(mapPrompt, CHAT_MODEL_FAST, CHAT_MODEL_STRONG, 0.1);
}

export async function mapReduceSummary(videoId: string): Promise<string> {
  const chunks = await getAllChunks(videoId);
  if (!chunks.length) {
    return "No indexed content available to summarize. Please process the video first.";
  }

  const chunkSummaries: string[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    chunkSummaries.push(await summarizeChunk(chunks[i], i));
  }

  const combinedSummaries = chunkSummaries.join("\n\n--- Next Section ---\n\n");
  const reducePrompt = `
                        You are provided with chronological summaries of different sections of a video.
                        Create a comprehensive, cohesive, and structured final summary of the entire video.
                        Use headings and bullet points where appropriate.
                        Do not add any extra information or commentary.
                        Maintain original tone and style of the transcript.


                        Chronological Segment Summaries:
                        ${combinedSummaries}
                    `;

  return generateWithFallback(reducePrompt, CHAT_MODEL_FAST, CHAT_MODEL_STRONG, 0.1);
}

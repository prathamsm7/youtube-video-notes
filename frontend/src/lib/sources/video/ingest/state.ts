import { Annotation } from "@langchain/langgraph";
import type { TranscriptSegment, VideoTextChunk } from "../types";

export const VideoIngestStateAnnotation = Annotation.Root({
  videoId: Annotation<string>,
  status: Annotation<string>,
  transcript: Annotation<TranscriptSegment[]>,
  chunks: Annotation<VideoTextChunk[]>,
  totalChunks: Annotation<number>,
  processedChunks: Annotation<number>,
  error: Annotation<string | null>,
  completed: Annotation<boolean>,
});

export type VideoIngestState = typeof VideoIngestStateAnnotation.State;

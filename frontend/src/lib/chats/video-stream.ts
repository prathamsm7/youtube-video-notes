import { MessageRole } from "@prisma/client";
import { after } from "next/server";
import { setVideoSummary, streamVideoQuery } from "@/lib/sources/video";
import { getRecentMessages, saveMessage, toApiRole } from "./db";
import { createSseAnswerStream, mapQueryEventToSse } from "./sse";

type VideoAnswerParams = {
  userId: number;
  chatId: string;
  videoDbId: string;
  youtubeId: string;
  cachedSummary: string | null;
  question: string;
};

export function createVideoAnswerStream(params: VideoAnswerParams) {
  const { userId, chatId, videoDbId, youtubeId, cachedSummary, question } = params;

  return createSseAnswerStream(
    async (send) => {
      const [history] = await Promise.all([
        getRecentMessages(chatId, 6),
        saveMessage(chatId, MessageRole.USER, question),
      ]);

      const chatHistory = history.map((message) => ({
        role: toApiRole(message.role),
        content: message.content,
      }));

      send({ type: "started", question });

      let answer = "";
      let summaryGenerated = false;

      for await (const event of streamVideoQuery(
        youtubeId,
        question,
        chatHistory,
        cachedSummary,
        { userId, chatId },
      )) {
        if (event.kind === "meta") {
          summaryGenerated = event.payload.summary_generated;
          continue;
        }

        const mapped = mapQueryEventToSse(event);
        if (!mapped) continue;

        if (mapped.token) {
          answer += mapped.token;
        }
        send(mapped.payload);
      }

      return { answer, summaryGenerated };
    },
    async ({ answer, summaryGenerated }) => {
      after(async () => {
        try {
          if (!answer.trim()) return;
          await saveMessage(chatId, MessageRole.ASSISTANT, answer);
          if (summaryGenerated) {
            await setVideoSummary(videoDbId, answer);
          }
        } catch (error) {
          console.error("[chats/video] failed to save assistant message:", error);
        }
      });
    },
  );
}

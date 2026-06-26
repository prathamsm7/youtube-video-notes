import { MessageRole } from "@prisma/client";
import { prisma } from "../db";
import type { ChatWithSources } from "./types";

const VIDEO_WELCOME_MESSAGE =
  "I've successfully transcribed and analyzed the video! What would you like to know about it?";

const DOCUMENT_WELCOME_MESSAGE =
  "I've successfully extracted and indexed your document! Ask me anything about its text, tables, or visual content.";

const chatWithSourcesInclude = {
  video: true,
  document: true,
} as const;

const WELCOME_MESSAGES = {
  video: VIDEO_WELCOME_MESSAGE,
  document: DOCUMENT_WELCOME_MESSAGE,
} as const;

type CreateChatWithWelcomeInput =
  | {
      userId: number;
      title: string;
      source: { kind: "video"; videoId: string };
    }
  | {
      userId: number;
      title: string;
      source: { kind: "document"; documentId: string };
    };

const chatCreateInclude = {
  ...chatWithSourcesInclude,
  messages: { orderBy: { createdAt: "asc" as const } },
};

export async function createChatWithWelcome(input: CreateChatWithWelcomeInput) {
  const { userId, title, source } = input;

  return prisma.chat.create({
    data: {
      userId,
      title,
      ...(source.kind === "video"
        ? { videoId: source.videoId }
        : { documentId: source.documentId }),
      messages: {
        create: {
          role: MessageRole.ASSISTANT,
          content: WELCOME_MESSAGES[source.kind],
        },
      },
    },
    include: chatCreateInclude,
  });
}

export async function listUserChats(userId: number): Promise<ChatWithSources[]> {
  return prisma.chat.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: chatWithSourcesInclude,
  });
}

export async function getChatForUser(
  chatId: string,
  userId: number,
): Promise<ChatWithSources | null> {
  return prisma.chat.findFirst({
    where: { id: chatId, userId },
    include: chatWithSourcesInclude,
  });
}

export async function getChatMessagesForUser(chatId: string, userId: number) {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    select: { id: true },
  });
  if (!chat) return null;

  return prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getRecentMessages(chatId: string, limit = 6) {
  const messages = await prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return messages.reverse();
}

export async function saveMessage(
  chatId: string,
  role: MessageRole,
  content: string,
) {
  const message = await prisma.message.create({
    data: { chatId, role, content },
  });
  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });
  return message;
}

export function toApiRole(role: MessageRole): "user" | "assistant" {
  return role === MessageRole.USER ? "user" : "assistant";
}

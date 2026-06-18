import { MessageRole } from "@prisma/client";
import { prisma } from "./db";

const WELCOME_MESSAGE =
  "I've successfully transcribed and analyzed the video! What would you like to know about it?";

export async function createChatWithWelcome(
  userId: number,
  videoId: string,
  title: string,
) {
  return prisma.chat.create({
    data: {
      userId,
      videoId,
      title,
      messages: {
        create: {
          role: MessageRole.ASSISTANT,
          content: WELCOME_MESSAGE,
        },
      },
    },
    include: { video: true, messages: { orderBy: { createdAt: "asc" } } },
  });
}

export async function listUserChats(userId: number) {
  return prisma.chat.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      video: true,
    },
  });
}

export async function getChatMetadataForUser(chatId: string, userId: number) {
  return prisma.chat.findFirst({
    where: { id: chatId, userId },
    include: { video: true },
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

export async function getChatForUser(chatId: string, userId: number) {
  return getChatMetadataForUser(chatId, userId);
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

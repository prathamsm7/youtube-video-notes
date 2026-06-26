import { VideoStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function ensureVideo(youtubeId: string, url: string, title: string) {
  return prisma.video.upsert({
    where: { youtubeId },
    create: { youtubeId, url, title, status: VideoStatus.PENDING },
    update: { url, title },
  });
}

export async function setVideoProcessing(videoId: string) {
  return prisma.video.update({
    where: { id: videoId },
    data: { status: VideoStatus.PROCESSING, errorMessage: null },
  });
}

export async function setVideoReady(videoId: string, totalChunks: number) {
  return prisma.video.update({
    where: { id: videoId },
    data: {
      status: VideoStatus.READY,
      totalChunks,
      processedAt: new Date(),
      errorMessage: null,
    },
  });
}

export async function setVideoFailed(videoId: string, errorMessage: string) {
  return prisma.video.update({
    where: { id: videoId },
    data: { status: VideoStatus.FAILED, errorMessage },
  });
}

export async function setVideoSummary(videoId: string, summary: string) {
  return prisma.video.update({
    where: { id: videoId },
    data: { summary, summaryGeneratedAt: new Date() },
  });
}

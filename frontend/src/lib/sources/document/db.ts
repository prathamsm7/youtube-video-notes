import { DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function createDocument(fileName: string) {
  return prisma.document.create({
    data: {
      fileName,
      status: DocumentStatus.PENDING,
    },
  });
}

export async function setDocumentProcessing(documentId: string) {
  return prisma.document.update({
    where: { id: documentId },
    data: { status: DocumentStatus.PROCESSING, errorMessage: null },
  });
}

export async function setDocumentReady(documentId: string, totalChunks: number) {
  return prisma.document.update({
    where: { id: documentId },
    data: {
      status: DocumentStatus.READY,
      totalChunks,
      processedAt: new Date(),
      errorMessage: null,
    },
  });
}

export async function setDocumentFailed(documentId: string, errorMessage: string) {
  return prisma.document.update({
    where: { id: documentId },
    data: { status: DocumentStatus.FAILED, errorMessage },
  });
}

export async function setDocumentSummary(documentId: string, summary: string) {
  return prisma.document.update({
    where: { id: documentId },
    data: { summary, summaryGeneratedAt: new Date() },
  });
}

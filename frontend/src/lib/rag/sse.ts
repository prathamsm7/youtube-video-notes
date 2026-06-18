export function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function sseComment(comment: string): string {
  return `: ${comment}\n\n`;
}

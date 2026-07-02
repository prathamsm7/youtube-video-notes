export function evalCooldownMs(): number {
  const raw = Number(process.env.EVAL_COOLDOWN_MS ?? 5000);
  return Number.isFinite(raw) && raw >= 0 ? raw : 5000;
}

export function evalJudgeGapMs(): number {
  const raw = Number(process.env.EVAL_JUDGE_GAP_MS ?? 500);
  return Number.isFinite(raw) && raw >= 0 ? raw : 500;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sequential CS-agent writes share one wall clock so a Pro retry after an
 * empty first writer cannot consume a second full 28s and starve persist.
 */

/** Outer budget for one generateAndStoreDraft call (order/listing preload + model). */
export const LIVE_CHAT_DRAFT_ATTEMPT_BUDGET_MS = 28_000

/** First writer + optional Pro retry together. */
export const LIVE_CHAT_DRAFT_TOTAL_BUDGET_MS = 45_000

/** Skip the Pro retry when leftover time cannot finish a useful generate. */
export const LIVE_CHAT_DRAFT_MIN_RETRY_MS = 8_000

export function liveChatGenerateAttemptBudgetMs(args: {
  startedAtMs: number
  nowMs?: number
  isRetry?: boolean
  attemptMs?: number
  totalMs?: number
  minRetryMs?: number
}): number {
  const elapsed = Math.max(0, (args.nowMs ?? Date.now()) - args.startedAtMs)
  const remaining = Math.max(0, (args.totalMs ?? LIVE_CHAT_DRAFT_TOTAL_BUDGET_MS) - elapsed)
  const capped = Math.min(args.attemptMs ?? LIVE_CHAT_DRAFT_ATTEMPT_BUDGET_MS, remaining)
  if (args.isRetry && capped < (args.minRetryMs ?? LIVE_CHAT_DRAFT_MIN_RETRY_MS)) {
    return 0
  }
  return capped
}

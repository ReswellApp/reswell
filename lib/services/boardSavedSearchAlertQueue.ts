/** Vercel Queue topic. One message per newly published listing. */
export const BOARD_SAVED_SEARCH_ALERT_TOPIC = "board-saved-search-alert"

/** How long the message stays available for redelivery. Covers the retry hour. */
export const BOARD_SAVED_SEARCH_ALERT_RETENTION_SECONDS = 2 * 60 * 60

/** Spacing between index-lag retries. */
export const BOARD_SAVED_SEARCH_ALERT_RETRY_SECONDS = 15 * 60

/** First delivery plus later passes. */
export const BOARD_SAVED_SEARCH_ALERT_MAX_DELIVERIES = 4

/** Stop retrying about an hour after the message was published. */
export const BOARD_SAVED_SEARCH_ALERT_WINDOW_MS = 60 * 60 * 1000

export class BoardSavedSearchAlertRetryError extends Error {
  constructor() {
    super("board_saved_search_index_pending")
    this.name = "BoardSavedSearchAlertRetryError"
  }
}

export type BoardSavedSearchAlertRetryReason = "index_pending" | "failed"

/**
 * What the queue should do after a consumer throws.
 * A finished match does not throw, so it is acknowledged by the queue itself.
 */
export function boardSavedSearchAlertRetryDecision(input: {
  deliveryCount: number
  createdAtMs: number
  nowMs: number
  reason: BoardSavedSearchAlertRetryReason
}): { afterSeconds: number } | { acknowledge: true } {
  if (input.reason !== "index_pending" && input.reason !== "failed") {
    return { acknowledge: true }
  }
  if (input.deliveryCount >= BOARD_SAVED_SEARCH_ALERT_MAX_DELIVERIES) {
    return { acknowledge: true }
  }
  if (!Number.isFinite(input.createdAtMs) || input.nowMs >= input.createdAtMs + BOARD_SAVED_SEARCH_ALERT_WINDOW_MS) {
    return { acknowledge: true }
  }
  return { afterSeconds: BOARD_SAVED_SEARCH_ALERT_RETRY_SECONDS }
}

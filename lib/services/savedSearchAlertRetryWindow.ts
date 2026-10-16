/** How long a new surfboard stays eligible for an index-lag retry. */
export const SAVED_SEARCH_ALERT_RETRY_WINDOW_MS = 60 * 60 * 1000

/** Spacing between retries. Matches the catch-up cron. */
export const SAVED_SEARCH_ALERT_RETRY_INTERVAL_MS = 15 * 60 * 1000

/** Initial publish check plus later passes, across the one-hour window. */
export const SAVED_SEARCH_ALERT_MAX_ATTEMPTS = 4

/**
 * A stuck watermark must not replay months of boards that were already listed.
 * The catch-up only looks this far behind "now".
 */
export const SAVED_SEARCH_ALERT_LOOKBACK_MS = 6 * 60 * 60 * 1000

export function savedSearchAlertLookbackStart(cursorIso: string, now: Date): string {
  const cursorMs = Date.parse(cursorIso)
  const floor = now.getTime() - SAVED_SEARCH_ALERT_LOOKBACK_MS
  if (!Number.isFinite(cursorMs)) return new Date(floor).toISOString()
  return new Date(Math.max(cursorMs, floor)).toISOString()
}

export type SavedSearchAlertRetrySchedule = {
  attempts: number
  nextAttemptAt: string
  giveUpAt: string
}

/**
 * Next index-lag retry, or null when the hour is over or the attempt budget is spent.
 * `attempts` is how many checks have already been scheduled.
 */
export function nextSavedSearchAlertRetry(input: {
  listedAt: string
  now: Date
  attempts: number
}): SavedSearchAlertRetrySchedule | null {
  if (input.attempts >= SAVED_SEARCH_ALERT_MAX_ATTEMPTS) return null
  const listedMs = Date.parse(input.listedAt)
  if (!Number.isFinite(listedMs)) return null
  const giveUpMs = listedMs + SAVED_SEARCH_ALERT_RETRY_WINDOW_MS
  if (input.now.getTime() >= giveUpMs) return null
  const nextMs = Math.min(input.now.getTime() + SAVED_SEARCH_ALERT_RETRY_INTERVAL_MS, giveUpMs)
  return {
    attempts: input.attempts + 1,
    nextAttemptAt: new Date(nextMs).toISOString(),
    giveUpAt: new Date(giveUpMs).toISOString(),
  }
}

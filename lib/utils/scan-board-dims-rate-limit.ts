/**
 * In-memory per-user rate limits for sell vision helpers (sticker scan + photo extract).
 * Best-effort across a single server instance (adequate for MVP abuse control).
 */

const WINDOW_MS = 60 * 60 * 1000
const MAX_SCANS_PER_WINDOW = 10
const MAX_EXTRACTS_PER_WINDOW = 20

const scanTimestampsByUserId = new Map<string, number[]>()
const extractTimestampsByUserId = new Map<string, number[]>()

function checkRateLimit(
  store: Map<string, number[]>,
  userId: string,
  maxPerWindow: number,
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const prev = store.get(userId) ?? []
  const recent = prev.filter((t) => t > cutoff)
  store.set(userId, recent)

  if (recent.length >= maxPerWindow) {
    const oldest = recent[0] ?? now
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000))
    return { ok: false, retryAfterSeconds }
  }

  recent.push(now)
  store.set(userId, recent)
  return { ok: true }
}

export function checkScanBoardDimsRateLimit(userId: string): {
  ok: true
} | {
  ok: false
  retryAfterSeconds: number
} {
  return checkRateLimit(scanTimestampsByUserId, userId, MAX_SCANS_PER_WINDOW)
}

export function checkExtractListingFromPhotosRateLimit(userId: string): {
  ok: true
} | {
  ok: false
  retryAfterSeconds: number
} {
  return checkRateLimit(extractTimestampsByUserId, userId, MAX_EXTRACTS_PER_WINDOW)
}

export const SCAN_BOARD_DIMS_RATE_LIMIT_MESSAGE =
  "You’ve scanned a few times recently. Wait a bit, or enter dimensions manually."

export const EXTRACT_LISTING_FROM_PHOTOS_RATE_LIMIT_MESSAGE =
  "We’ve looked at your photos a few times already. Enter remaining details manually, or try again later."

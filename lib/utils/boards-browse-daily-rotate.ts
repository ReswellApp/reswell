/** 24-hour window from Unix epoch — same order for every visitor until the bucket ticks. */
const DAY_MS = 86_400_000

export function boardsBrowseDailyRotateSeed(nowMs = Date.now()): string {
  return String(Math.floor(nowMs / DAY_MS))
}

/** Inclusive start of the current 24h rotate bucket (Unix ms). */
export function boardsBrowseDailyRotateWindowStartMs(seed: string): number {
  const n = Number(seed)
  if (!Number.isFinite(n) || n < 0) return 0
  return n * DAY_MS
}

export function listingCreatedAtMs(createdAt: string | number | null | undefined): number {
  if (typeof createdAt === "number" && Number.isFinite(createdAt)) return createdAt
  if (typeof createdAt === "string" && createdAt.trim()) {
    const ms = new Date(createdAt).getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

/** Listed after this rotate window started — pin above the seeded shuffle, do not rehash. */
export function isListingNewToDailyRotate(createdAtMs: number, seed: string): boolean {
  return createdAtMs >= boardsBrowseDailyRotateWindowStartMs(seed)
}

/** cyrb53 — deterministic 53-bit string hash for seeded browse order. */
export function hashStringCyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export function compareIdsByDailyRotateSeed(a: string, b: string, seed: string): number {
  const ha = hashStringCyrb53(`${seed}:${a}`)
  const hb = hashStringCyrb53(`${seed}:${b}`)
  if (ha !== hb) return ha < hb ? -1 : 1
  return a < b ? -1 : a > b ? 1 : 0
}

export type BoardsBrowseRotateIdRow = {
  id: string
  suppressed?: boolean
  createdAtMs?: number
}

/**
 * Stable permutation for the current 24h seed. New listings from this window
 * stay at the top (newest first) without reshuffling the rest. Suppressed
 * listings stay last.
 */
export function compareRotateIdRowsForDailyRotate(
  a: BoardsBrowseRotateIdRow,
  b: BoardsBrowseRotateIdRow,
  seed: string,
): number {
  const supA = a.suppressed ? 1 : 0
  const supB = b.suppressed ? 1 : 0
  if (supA !== supB) return supA - supB

  const windowStart = boardsBrowseDailyRotateWindowStartMs(seed)
  const newA = (a.createdAtMs ?? 0) >= windowStart ? 1 : 0
  const newB = (b.createdAtMs ?? 0) >= windowStart ? 1 : 0
  if (newA !== newB) return newB - newA

  if (newA === 1) {
    const ca = a.createdAtMs ?? 0
    const cb = b.createdAtMs ?? 0
    if (ca !== cb) return cb - ca
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  }

  return compareIdsByDailyRotateSeed(a.id, b.id, seed)
}

export function orderListingIdsForDailyRotate(
  rows: BoardsBrowseRotateIdRow[],
  seed: string,
): string[] {
  return [...rows]
    .sort((a, b) => compareRotateIdRowsForDailyRotate(a, b, seed))
    .map((row) => row.id)
}

/**
 * Admin-pinned listings stay at the front of `/boards` in curation order.
 * `skipIds` (e.g. suppressed) keep their existing position instead of being promoted.
 * Unknown pin ids (inactive / not in this view) are dropped.
 */
export function prependPinnedListingIds(
  orderedIds: string[],
  pinnedIds: string[],
  opts?: { skipIds?: ReadonlySet<string> },
): string[] {
  if (pinnedIds.length === 0) return orderedIds

  const skip = opts?.skipIds
  const orderedSet = new Set(orderedIds)
  const pinnedSet = new Set(pinnedIds)
  const seen = new Set<string>()
  const pinnedFront: string[] = []

  for (const id of pinnedIds) {
    if (seen.has(id)) continue
    seen.add(id)
    if (!orderedSet.has(id)) continue
    if (skip?.has(id)) continue
    pinnedFront.push(id)
  }

  if (pinnedFront.length === 0) return orderedIds

  const rest = orderedIds.filter((id) => !pinnedSet.has(id) || Boolean(skip?.has(id)))
  return [...pinnedFront, ...rest]
}

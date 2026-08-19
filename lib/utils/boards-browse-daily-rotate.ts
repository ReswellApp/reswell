/** 24-hour window from Unix epoch — same order for every visitor until the bucket ticks. */
const DAY_MS = 86_400_000

export function boardsBrowseDailyRotateSeed(nowMs = Date.now()): string {
  return String(Math.floor(nowMs / DAY_MS))
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
}

/**
 * Stable permutation for the current 24h seed. Suppressed listings stay last;
 * adding/removing a listing does not reshuffle the rest.
 */
export function orderListingIdsForDailyRotate(
  rows: BoardsBrowseRotateIdRow[],
  seed: string,
): string[] {
  return [...rows]
    .sort((a, b) => {
      const supA = a.suppressed ? 1 : 0
      const supB = b.suppressed ? 1 : 0
      if (supA !== supB) return supA - supB
      return compareIdsByDailyRotateSeed(a.id, b.id, seed)
    })
    .map((row) => row.id)
}

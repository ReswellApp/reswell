import { GIVEAWAY_PRIZE_BRAND_IDS, type GiveawayPrizeBrandId } from "@/lib/types/giveaways"

const STORAGE_KEY = "rw_giveaway_entry_intent"

export type GiveawayEntryIntent = {
  slug: string
  brand: GiveawayPrizeBrandId | null
  fromCta?: boolean
}

function isPrizeBrandId(value: string): value is GiveawayPrizeBrandId {
  return (GIVEAWAY_PRIZE_BRAND_IDS as readonly string[]).includes(value)
}

export function readGiveawayEntryIntent(): GiveawayEntryIntent | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      slug?: unknown
      brand?: unknown
      fromCta?: unknown
    }
    if (typeof parsed.slug !== "string" || !parsed.slug.trim()) return null
    const brand =
      typeof parsed.brand === "string" && isPrizeBrandId(parsed.brand)
        ? parsed.brand
        : null
    return {
      slug: parsed.slug.trim(),
      brand,
      fromCta: parsed.fromCta === true,
    }
  } catch {
    return null
  }
}

export function writeGiveawayEntryIntent(intent: GiveawayEntryIntent): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(intent))
  } catch {
    /* private mode */
  }
}

export function clearGiveawayEntryIntent(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function parseGiveawayBrandParam(
  value: string | null | undefined,
): GiveawayPrizeBrandId | null {
  if (!value) return null
  return isPrizeBrandId(value) ? value : null
}

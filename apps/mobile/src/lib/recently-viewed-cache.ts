import { mobileListingCardSchema } from "@reswell/api-contract"
import type { MobileListingCard } from "@reswell/api-contract"
import * as SecureStore from "expo-secure-store"
import { z } from "zod"
import { fetchRecentlyViewed } from "@/lib/api"

const KEY_PREFIX = "reswell.recently-viewed"
const MAX_LISTINGS = 12

const storedSchema = z.array(mobileListingCardSchema)

const memoryByUser = new Map<string, MobileListingCard[]>()

function storageKey(userId: string): string {
  return `${KEY_PREFIX}.${userId}`
}

/** Instant read after the cache has been hydrated or refreshed. */
export function getRecentlyViewedCached(userId: string | null | undefined): MobileListingCard[] {
  if (!userId) return []
  return memoryByUser.get(userId) ?? []
}

export function clearRecentlyViewedCache(userId: string | null | undefined): void {
  if (!userId) return
  memoryByUser.delete(userId)
  SecureStore.deleteItemAsync(storageKey(userId)).catch(() => undefined)
}

/** Load disk cache into memory so search can render thumbnails immediately. */
export async function hydrateRecentlyViewedCache(userId: string): Promise<MobileListingCard[]> {
  const existing = memoryByUser.get(userId)
  if (existing && existing.length > 0) return existing

  const raw = await SecureStore.getItemAsync(storageKey(userId))
  if (!raw) {
    memoryByUser.set(userId, [])
    return []
  }
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw))
    const listings = parsed.success ? parsed.data.slice(0, MAX_LISTINGS) : []
    memoryByUser.set(userId, listings)
    return listings
  } catch {
    memoryByUser.set(userId, [])
    return []
  }
}

async function persistRecentlyViewed(userId: string, listings: MobileListingCard[]): Promise<void> {
  const trimmed = listings.slice(0, MAX_LISTINGS)
  memoryByUser.set(userId, trimmed)
  await SecureStore.setItemAsync(storageKey(userId), JSON.stringify(trimmed))
}

/** Network fetch, then update memory + disk. Returns the fresh list. */
export async function refreshRecentlyViewed(accessToken: string, userId: string): Promise<MobileListingCard[]> {
  const page = await fetchRecentlyViewed(accessToken)
  await persistRecentlyViewed(userId, page.listings)
  return page.listings.slice(0, MAX_LISTINGS)
}

/** Show cached listings immediately, then refresh in the background when stale. */
export async function loadRecentlyViewedForSearch(
  accessToken: string,
  userId: string,
  options?: { refresh?: boolean },
): Promise<MobileListingCard[]> {
  const cached = await hydrateRecentlyViewedCache(userId)
  if (!options?.refresh && cached.length > 0) {
    refreshRecentlyViewed(accessToken, userId).catch(() => undefined)
    return cached
  }
  try {
    return await refreshRecentlyViewed(accessToken, userId)
  } catch {
    return cached
  }
}

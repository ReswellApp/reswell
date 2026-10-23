import { mobileRecentlyViewedSchema, type MobileRecentlyViewed } from "@reswell/api-contract"
import { listUserRecentlyViewedListingIds } from "@/lib/db/navSearchPersonalization"
import { listMobileListingRowsByIds } from "@/lib/db/mobile-listings"
import { isListingPubliclyVisible } from "@/lib/listing-public-visibility"
import { toMobileListingCard, type MobileApiResult } from "@/lib/services/mobileApi"
import type { SupabaseClient } from "@supabase/supabase-js"

/** Enough history that hidden or sold rows can drop out and the rail still fills. */
const RECENTLY_VIEWED_LOOKUP = 24
const RECENTLY_VIEWED_LIMIT = 12

/**
 * The signed-in website history in `user_recently_viewed_listings`.
 * Kept off the public homepage payload because it is personal.
 */
export async function getMobileRecentlyViewedService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<MobileRecentlyViewed>> {
  const ids = await listUserRecentlyViewedListingIds(supabase, userId, RECENTLY_VIEWED_LOOKUP)
  const listed = await listMobileListingRowsByIds(ids)
  if (!listed.ok) {
    console.error("[mobile-api] recently viewed failed", {
      timestamp: new Date().toISOString(),
      message: listed.message,
    })
    return { ok: false, status: 500, error: "Unable to load recently viewed listings right now" }
  }

  const listings = []
  for (const row of listed.rows) {
    if (!isListingPubliclyVisible(row)) continue
    const card = toMobileListingCard(row)
    if (!card) continue
    listings.push(card)
    if (listings.length >= RECENTLY_VIEWED_LIMIT) break
  }

  const parsed = mobileRecentlyViewedSchema.safeParse({ listings })
  if (!parsed.success) {
    return { ok: false, status: 500, error: "Unable to load recently viewed listings right now" }
  }
  return { ok: true, data: parsed.data }
}

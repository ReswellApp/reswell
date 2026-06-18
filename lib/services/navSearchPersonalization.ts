import { createClient } from "@/lib/supabase/server"
import {
  deleteUserRecentSearchQuery,
  fetchNavPersonalizationBrandsByIds,
  fetchNavPersonalizationListingsByIds,
  listUserRecentSearchQueries,
  listUserRecentlyViewedBrandIds,
  listUserRecentlyViewedListingIds,
  resolveBrandIdForNavPick,
  upsertUserRecentSearchQuery,
  upsertUserRecentlyViewedBrand,
  upsertUserRecentlyViewedListing,
} from "@/lib/db/navSearchPersonalization"
import type { NavSearchPersonalization } from "@/lib/types/nav-search-personalization"
import { z } from "zod"

const querySchema = z.string().trim().min(1).max(200)

const brandPickSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).nullable().optional(),
})

export async function loadNavSearchPersonalizationForUser(
  userId: string,
): Promise<NavSearchPersonalization> {
  const supabase = await createClient()

  const [recentSearches, viewedIds, brandIds] = await Promise.all([
    listUserRecentSearchQueries(supabase, userId),
    listUserRecentlyViewedListingIds(supabase, userId),
    listUserRecentlyViewedBrandIds(supabase, userId),
  ])

  const [recentlyViewed, recentlyViewedBrands] = await Promise.all([
    fetchNavPersonalizationListingsByIds(supabase, viewedIds),
    fetchNavPersonalizationBrandsByIds(supabase, brandIds),
  ])

  return { recentSearches, recentlyViewed, recentlyViewedBrands }
}

export async function recordNavSearchPersonalizationQuery(
  userId: string,
  rawQuery: unknown,
): Promise<void> {
  const parsed = querySchema.safeParse(rawQuery)
  if (!parsed.success) return

  const supabase = await createClient()
  await upsertUserRecentSearchQuery(supabase, userId, parsed.data)
}

export async function removeNavSearchPersonalizationQuery(
  userId: string,
  rawQuery: unknown,
): Promise<void> {
  const parsed = querySchema.safeParse(rawQuery)
  if (!parsed.success) return

  const supabase = await createClient()
  await deleteUserRecentSearchQuery(supabase, userId, parsed.data)
}

export async function recordNavRecentlyViewedListingForUser(
  userId: string,
  listingId: string,
): Promise<void> {
  const supabase = await createClient()
  await upsertUserRecentlyViewedListing(supabase, userId, listingId)
}

export async function recordNavRecentlyViewedBrandForUser(
  userId: string,
  rawPick: unknown,
): Promise<void> {
  const parsed = brandPickSchema.safeParse(rawPick)
  if (!parsed.success) return

  const supabase = await createClient()
  const brandId = await resolveBrandIdForNavPick(supabase, {
    slug: parsed.data.slug ?? null,
    name: parsed.data.name,
  })
  if (!brandId) return

  await upsertUserRecentlyViewedBrand(supabase, userId, brandId)
}

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listingTitleThumbnailCandidates,
  type ListingImageForCard,
} from "@/lib/listing-image-display"
import type {
  NavSearchPersonalizationBrand,
  NavSearchPersonalizationListing,
} from "@/lib/types/nav-search-personalization"

export const MAX_USER_RECENT_SEARCHES = 5
/** Matches `record_user_listing_view` trim cap in DB. */
export const MAX_USER_RECENTLY_VIEWED = 100
export const NAV_RECENTLY_VIEWED_DISPLAY_LIMIT = 10
export const MAX_USER_RECENTLY_VIEWED_BRANDS = 24
export const NAV_RECENTLY_VIEWED_BRANDS_DISPLAY_LIMIT = 10
/** Active boards shown in PDP “Recently viewed” strips. */
export const PDP_RECENTLY_VIEWED_DISPLAY_LIMIT = 6

/** PostgREST: relation not exposed / not in schema cache (e.g. migration not applied yet). */
export function isUserRecentlyViewedBrandsUnavailable(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false
  if (error.code === "PGRST205") return true
  const msg = error.message ?? ""
  return msg.includes("user_recently_viewed_brands") && msg.includes("schema cache")
}

function logNavBrandPersonalizationError(
  context: string,
  error: { code?: string; message?: string },
): void {
  if (isUserRecentlyViewedBrandsUnavailable(error)) return
  console.error(`[navSearchPersonalization] ${context}:`, error)
}

function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase()
}

export function navPersonalizationListingFromRow(
  record: Record<string, unknown>,
): NavSearchPersonalizationListing {
  const imgs = (record.listing_images as ListingImageForCard[] | null) ?? []
  const imageUrlCandidates = listingTitleThumbnailCandidates(imgs)
  return {
    id: String(record.id ?? ""),
    slug: typeof record.slug === "string" ? record.slug : null,
    title: typeof record.title === "string" ? record.title : "",
    price: Number(record.price) || 0,
    imageUrl: imageUrlCandidates[0] ?? null,
    imageUrlCandidates,
  }
}

export async function listUserRecentSearchQueries(
  supabase: SupabaseClient,
  userId: string,
  limit = MAX_USER_RECENT_SEARCHES,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_recent_searches")
    .select("query")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[navSearchPersonalization] list searches:", error)
    return []
  }

  return (data ?? [])
    .map((row) => (typeof row.query === "string" ? row.query.trim() : ""))
    .filter(Boolean)
}

export async function upsertUserRecentSearchQuery(
  supabase: SupabaseClient,
  userId: string,
  query: string,
): Promise<void> {
  const trimmed = query.trim()
  if (!trimmed) return

  const query_normalized = normalizeSearchQuery(trimmed)

  const { error: upsertErr } = await supabase.from("user_recent_searches").upsert(
    {
      user_id: userId,
      query: trimmed,
      query_normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,query_normalized" },
  )

  if (upsertErr) {
    console.error("[navSearchPersonalization] upsert search:", upsertErr)
    return
  }

  const { data: rows, error: listErr } = await supabase
    .from("user_recent_searches")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (listErr || !rows || rows.length <= MAX_USER_RECENT_SEARCHES) return

  const staleIds = rows.slice(MAX_USER_RECENT_SEARCHES).map((row) => row.id as string)
  if (staleIds.length === 0) return

  const { error: deleteErr } = await supabase
    .from("user_recent_searches")
    .delete()
    .in("id", staleIds)

  if (deleteErr) {
    console.error("[navSearchPersonalization] trim searches:", deleteErr)
  }
}

export async function deleteUserRecentSearchQuery(
  supabase: SupabaseClient,
  userId: string,
  query: string,
): Promise<void> {
  const query_normalized = normalizeSearchQuery(query)
  if (!query_normalized) return

  const { error } = await supabase
    .from("user_recent_searches")
    .delete()
    .eq("user_id", userId)
    .eq("query_normalized", query_normalized)

  if (error) {
    console.error("[navSearchPersonalization] delete search:", error)
  }
}

export async function upsertUserRecentlyViewedListing(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<void> {
  const id = listingId.trim()
  if (!id) return

  const { error } = await supabase.rpc("record_user_listing_view", {
    p_user_id: userId,
    p_listing_id: id,
  })

  if (error) {
    console.error("[navSearchPersonalization] record viewed:", error)
  }
}

export async function listUserRecentlyViewedListingIds(
  supabase: SupabaseClient,
  userId: string,
  limit = NAV_RECENTLY_VIEWED_DISPLAY_LIMIT,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_recently_viewed_listings")
    .select("listing_id")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[navSearchPersonalization] list viewed ids:", error)
    return []
  }

  return (data ?? [])
    .map((row) => (typeof row.listing_id === "string" ? row.listing_id : ""))
    .filter(Boolean)
}

export async function fetchNavPersonalizationListingsByIds(
  supabase: SupabaseClient,
  orderedIds: readonly string[],
): Promise<NavSearchPersonalizationListing[]> {
  const unique = [...new Set(orderedIds.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select("id, slug, title, price, listing_images (url, thumbnail_url, is_primary)")
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .in("id", unique)

  if (error || !data?.length) return []

  const byId = new Map<string, NavSearchPersonalizationListing>()
  for (const row of data as Record<string, unknown>[]) {
    const id = row.id != null ? String(row.id) : ""
    if (id) byId.set(id, navPersonalizationListingFromRow(row))
  }

  const out: NavSearchPersonalizationListing[] = []
  for (const id of orderedIds) {
    const listing = byId.get(id.trim())
    if (listing) out.push(listing)
  }
  return out
}

export function navPersonalizationBrandFromRow(
  record: Record<string, unknown>,
): NavSearchPersonalizationBrand | null {
  const id = record.id != null ? String(record.id) : ""
  const slug = typeof record.slug === "string" ? record.slug.trim() : ""
  const name = typeof record.name === "string" ? record.name.trim() : ""
  if (!id || !slug || !name) return null

  return {
    id,
    slug,
    name,
    logoUrl: typeof record.logo_url === "string" ? record.logo_url.trim() || null : null,
  }
}

export async function resolveBrandIdForNavPick(
  supabase: SupabaseClient,
  args: { slug?: string | null; name: string },
): Promise<string | null> {
  const slug = args.slug?.trim()
  if (slug) {
    const { data, error } = await supabase
      .from("brands")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()

    if (!error && data?.id) return String(data.id)
  }

  const name = args.name.trim()
  if (!name) return null

  const { data, error } = await supabase
    .from("brands")
    .select("id, name")
    .ilike("name", name)
    .limit(8)

  if (error || !data?.length) return null

  const lower = name.toLowerCase()
  const exact = data.find((row) => typeof row.name === "string" && row.name.toLowerCase() === lower)
  if (exact?.id) return String(exact.id)

  return data[0]?.id ? String(data[0].id) : null
}

export async function upsertUserRecentlyViewedBrand(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
): Promise<void> {
  const id = brandId.trim()
  if (!id) return

  const { error: upsertErr } = await supabase.from("user_recently_viewed_brands").upsert(
    {
      user_id: userId,
      brand_id: id,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,brand_id" },
  )

  if (upsertErr) {
    logNavBrandPersonalizationError("upsert brand", upsertErr)
    return
  }

  const { data: rows, error: listErr } = await supabase
    .from("user_recently_viewed_brands")
    .select("brand_id")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })

  if (listErr) {
    logNavBrandPersonalizationError("list brands for trim", listErr)
    return
  }
  if (!rows || rows.length <= MAX_USER_RECENTLY_VIEWED_BRANDS) return

  const staleIds = rows.slice(MAX_USER_RECENTLY_VIEWED_BRANDS).map((row) => row.brand_id as string)
  if (staleIds.length === 0) return

  const { error: deleteErr } = await supabase
    .from("user_recently_viewed_brands")
    .delete()
    .eq("user_id", userId)
    .in("brand_id", staleIds)

  if (deleteErr) {
    logNavBrandPersonalizationError("trim brands", deleteErr)
  }
}

export async function listUserRecentlyViewedBrandIds(
  supabase: SupabaseClient,
  userId: string,
  limit = NAV_RECENTLY_VIEWED_BRANDS_DISPLAY_LIMIT,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_recently_viewed_brands")
    .select("brand_id")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(limit)

  if (error) {
    logNavBrandPersonalizationError("list brand ids", error)
    return []
  }

  return (data ?? [])
    .map((row) => (typeof row.brand_id === "string" ? row.brand_id : ""))
    .filter(Boolean)
}

export async function fetchNavPersonalizationBrandsByIds(
  supabase: SupabaseClient,
  orderedIds: readonly string[],
): Promise<NavSearchPersonalizationBrand[]> {
  const unique = [...new Set(orderedIds.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const { data, error } = await supabase
    .from("brands")
    .select("id, slug, name, logo_url")
    .in("id", unique)

  if (error || !data?.length) return []

  const byId = new Map<string, NavSearchPersonalizationBrand>()
  for (const row of data as Record<string, unknown>[]) {
    const brand = navPersonalizationBrandFromRow(row)
    if (brand) byId.set(brand.id, brand)
  }

  const out: NavSearchPersonalizationBrand[] = []
  for (const id of orderedIds) {
    const brand = byId.get(id.trim())
    if (brand) out.push(brand)
  }
  return out
}

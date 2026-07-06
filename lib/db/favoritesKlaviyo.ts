import type { SupabaseClient } from "@supabase/supabase-js"
import type { KlaviyoListingProductSource } from "@/lib/klaviyo/catalog-product"
import { isListingPurchasable, type ListingPublicVisibilityFields } from "@/lib/listing-public-visibility"

const FAVORITE_LISTING_SELECT = `
  id,
  user_id,
  slug,
  title,
  description,
  price,
  section,
  city,
  state,
  board_type,
  brand,
  condition,
  status,
  hidden_from_site,
  archived_at,
  listing_images ( url, thumbnail_url, is_primary, sort_order )
`.trim()

export type KlaviyoFavoriteListingRow = KlaviyoListingProductSource &
  ListingPublicVisibilityFields & {
    user_id?: string | null
  }

function normalizeFavoriteListingRow(raw: unknown): KlaviyoFavoriteListingRow | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const id = typeof row.id === "string" ? row.id.trim() : ""
  if (!id) return null
  const status = typeof row.status === "string" ? row.status : ""
  return {
    id,
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    slug: typeof row.slug === "string" ? row.slug : null,
    title: typeof row.title === "string" ? row.title : null,
    description: typeof row.description === "string" ? row.description : null,
    price: row.price as string | number | null,
    section: typeof row.section === "string" ? row.section : null,
    city: typeof row.city === "string" ? row.city : null,
    state: typeof row.state === "string" ? row.state : null,
    board_type: typeof row.board_type === "string" ? row.board_type : null,
    brand: typeof row.brand === "string" ? row.brand : null,
    condition: typeof row.condition === "string" ? row.condition : null,
    status,
    hidden_from_site: row.hidden_from_site as boolean | null | undefined,
    archived_at: row.archived_at as string | null | undefined,
    listing_images: Array.isArray(row.listing_images)
      ? (row.listing_images as KlaviyoListingProductSource["listing_images"])
      : null,
  }
}

export function isFavoriteListingEligibleForKlaviyoCommerce(
  listing: ListingPublicVisibilityFields,
): boolean {
  return isListingPurchasable(listing)
}

export async function fetchListingForKlaviyoFavoriteEvent(
  supabase: SupabaseClient,
  listingId: string,
): Promise<KlaviyoFavoriteListingRow | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(FAVORITE_LISTING_SELECT)
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  return normalizeFavoriteListingRow(data)
}

export async function fetchPurchasableFavoriteListingsForKlaviyo(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
): Promise<KlaviyoFavoriteListingRow[]> {
  const cap = Math.max(1, Math.min(limit, 24))
  const { data, error } = await supabase
    .from("favorites")
    .select(
      `
      created_at,
      listing:listings (
        ${FAVORITE_LISTING_SELECT}
      )
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(48)

  if (error) return []

  const listings: KlaviyoFavoriteListingRow[] = []
  for (const row of data ?? []) {
    const raw = row as { listing: unknown | unknown[] | null }
    const nested = raw.listing
    const listingRaw = Array.isArray(nested) ? nested[0] : nested
    const listing = normalizeFavoriteListingRow(listingRaw)
    if (!listing) continue
    if (!isFavoriteListingEligibleForKlaviyoCommerce(listing)) continue
    listings.push(listing)
    if (listings.length >= cap) break
  }

  return listings
}

export async function fetchFavoriteUserIdsForListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("favorites")
    .select("user_id")
    .eq("listing_id", listingId)

  if (error) return []
  const ids = new Set<string>()
  for (const row of data ?? []) {
    const id = typeof row.user_id === "string" ? row.user_id.trim() : ""
    if (id) ids.add(id)
  }
  return [...ids]
}

export type FavoritesDigestEligibleUser = {
  userId: string
  email: string | null
  displayName: string | null
}

/**
 * Distinct users with at least one purchasable favorited listing who have not
 * received **Favorites Digest** in the lookback window (via `klaviyo_event_log`).
 */
export async function fetchUsersEligibleForFavoritesDigest(
  supabase: SupabaseClient,
  options: {
    referenceTime: Date
    minDaysSinceLastDigest?: number
    limit?: number
  },
): Promise<FavoritesDigestEligibleUser[]> {
  const minDays = options.minDaysSinceLastDigest ?? 7
  const lookbackMs = minDays * 24 * 60 * 60 * 1000
  const sinceIso = new Date(options.referenceTime.getTime() - lookbackMs).toISOString()
  const cap = Math.max(1, Math.min(options.limit ?? 500, 2000))

  const { data: favoriteRows, error: favErr } = await supabase
    .from("favorites")
    .select(
      `
      user_id,
      listing:listings!inner (
        status,
        hidden_from_site,
        archived_at
      )
    `,
    )
    .in("listings.status", ["active", "pending_sale"])
    .eq("listings.hidden_from_site", false)
    .is("listings.archived_at", null)
    .limit(5000)

  if (favErr || !favoriteRows?.length) return []

  const candidateIds = new Set<string>()
  for (const row of favoriteRows) {
    const userId = typeof row.user_id === "string" ? row.user_id.trim() : ""
    if (userId) candidateIds.add(userId)
  }

  if (candidateIds.size === 0) return []

  const recentlySent = new Set<string>()
  const { data: recentLogs } = await supabase
    .from("klaviyo_event_log")
    .select("profile_external_id")
    .eq("metric_name", "Favorites Digest")
    .eq("status", "sent")
    .gte("created_at", sinceIso)
    .in("profile_external_id", [...candidateIds])

  for (const log of recentLogs ?? []) {
    const id =
      typeof log.profile_external_id === "string" ? log.profile_external_id.trim() : ""
    if (id) recentlySent.add(id)
  }

  const eligibleIds = [...candidateIds].filter((id) => !recentlySent.has(id)).slice(0, cap)
  if (eligibleIds.length === 0) return []

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .in("id", eligibleIds)

  const byId = new Map<string, { email: string | null; displayName: string | null }>()
  for (const p of profiles ?? []) {
    const id = typeof p.id === "string" ? p.id : ""
    if (!id) continue
    byId.set(id, {
      email: typeof p.email === "string" && p.email.trim() ? p.email.trim() : null,
      displayName:
        typeof p.display_name === "string" && p.display_name.trim()
          ? p.display_name.trim()
          : null,
    })
  }

  return eligibleIds.map((userId) => {
    const profile = byId.get(userId)
    return {
      userId,
      email: profile?.email ?? null,
      displayName: profile?.displayName ?? null,
    }
  })
}

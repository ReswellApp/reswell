import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listCityTopSellerListingSeeds,
  listCityTopSellerProfiles,
  type CityTopSellerListingSeed,
  type CityTopSellerProfileRow,
} from "@/lib/db/city-top-sellers"
import { listSellersDirectoryDemotedProfileIdsOrdered } from "@/lib/db/sellers-directory-demotions"
import { sellerProfileHref } from "@/lib/seller-slug"
import { orderSellersWithDemotions } from "@/lib/sellers/directory-ranking"
import { deriveSellerDirectoryTileMeta } from "@/lib/sellers/directory-tile-meta"
import { resolveSellerProfileDisplayImageUrl } from "@/lib/sellers/profile-display-image"
import type { CityTopSeller } from "@/lib/types/city-top-sellers"

export const CITY_TOP_SELLERS_LIMIT = 12

type CityTopSellerCandidate = {
  id: string
  sales_count: number
  inventoryCount: number
  listings: CityTopSellerListingSeed[]
}

function trimText(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed.length > 0 ? trimmed : null
}

function sellerLabel(profile: CityTopSellerProfileRow): string {
  return trimText(profile.shop_name) || trimText(profile.display_name) || "Seller"
}

function profileUsesOwnImage(profile: CityTopSellerProfileRow): boolean {
  if (profile.is_shop && trimText(profile.shop_logo_url)) return true
  return Boolean(trimText(profile.avatar_url))
}

function locationLabelFromListings(
  listings: CityTopSellerListingSeed[],
  profileCity: string | null,
  fallbackCityLabel: string,
): string | null {
  const tileMeta = deriveSellerDirectoryTileMeta(listings)
  if (tileMeta.shipFromState) return tileMeta.shipFromState
  const locatedIn = tileMeta.locatedInLabel
  if (locatedIn?.startsWith("Located in ")) {
    return locatedIn.slice("Located in ".length)
  }
  return trimText(profileCity) ?? trimText(fallbackCityLabel)
}

function buildCandidates(
  seeds: CityTopSellerListingSeed[],
  profiles: CityTopSellerProfileRow[],
): CityTopSellerCandidate[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const listingsBySeller = new Map<string, CityTopSellerListingSeed[]>()

  for (const seed of seeds) {
    if (!profileById.has(seed.user_id)) continue
    const list = listingsBySeller.get(seed.user_id) ?? []
    list.push(seed)
    listingsBySeller.set(seed.user_id, list)
  }

  const candidates: CityTopSellerCandidate[] = []
  for (const [id, listings] of listingsBySeller) {
    const profile = profileById.get(id)
    if (!profile?.seller_slug?.trim()) continue
    const salesCount = Number(profile.sales_count ?? 0)
    if (salesCount < 1) continue

    candidates.push({
      id,
      sales_count: salesCount,
      inventoryCount: listings.filter((listing) => listing.status === "active").length,
      listings,
    })
  }

  return candidates
}

/**
 * Sellers tied to a city (via active/sold surfboard listings there) who have
 * completed at least one sale on Reswell (`profiles.sales_count >= 1`).
 */
export async function listCityTopSellers(
  supabase: SupabaseClient,
  locationLabel: string,
  cityName: string,
  limit = CITY_TOP_SELLERS_LIMIT,
): Promise<CityTopSeller[]> {
  if (limit <= 0) return []

  const [seeds, demotedOrder] = await Promise.all([
    listCityTopSellerListingSeeds(supabase, locationLabel),
    listSellersDirectoryDemotedProfileIdsOrdered(supabase),
  ])

  if (seeds.length === 0) return []

  const sellerIds = [...new Set(seeds.map((seed) => seed.user_id))]
  const profiles = await listCityTopSellerProfiles(supabase, sellerIds)
  if (profiles.length === 0) return []

  const candidates = buildCandidates(seeds, profiles)
  if (candidates.length === 0) return []

  const ranked = orderSellersWithDemotions(candidates, demotedOrder, (seller) => ({
    id: seller.id,
    sales_count: seller.sales_count,
    inventoryCount: seller.inventoryCount,
  }))

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const sellers: CityTopSeller[] = []

  for (const candidate of ranked) {
    const profile = profileById.get(candidate.id)
    if (!profile?.seller_slug?.trim()) continue

    sellers.push({
      id: profile.id,
      href: sellerProfileHref(profile),
      name: sellerLabel(profile),
      locationLabel: locationLabelFromListings(candidate.listings, profile.city, cityName),
      imageSrc: resolveSellerProfileDisplayImageUrl(profile, candidate.listings),
      imageFit: profileUsesOwnImage(profile) ? "contain" : "cover",
      salesCount: candidate.sales_count,
      shopVerified: profile.shop_verified === true,
    })

    if (sellers.length >= limit) break
  }

  return sellers
}

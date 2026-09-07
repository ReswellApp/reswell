import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listCategoryCompletedFulfillmentSales,
  listCategoryListingsForSellers,
  listCategoryTopShopProfiles,
  listCategoryTopShopReviewRows,
  type CategoryTopShopCompletedSaleRow,
  type CategoryTopShopListingRow,
  type CategoryTopShopProfileRow,
} from "@/lib/db/category-top-shops"
import { listSellersDirectoryDemotedProfileIdsOrdered } from "@/lib/db/sellers-directory-demotions"
import { sellerProfileHref } from "@/lib/seller-slug"
import { orderSellersWithDemotions } from "@/lib/sellers/directory-ranking"
import {
  deriveSellerDirectoryTileMeta,
  summarizeSellerReviews,
} from "@/lib/sellers/directory-tile-meta"
import { resolveSellerProfileDisplayImageUrl } from "@/lib/sellers/profile-display-image"
import type { CategoryTopShop, CategoryTopShopSection } from "@/lib/types/category-top-shops"

export const CATEGORY_TOP_SHOPS_LIMIT = 12
const CANDIDATE_FETCH_BUFFER = 24

export type CategoryTopShopCandidate = {
  id: string
  soldCount: number
  hasCompletedShipping: boolean
  hasCompletedPickup: boolean
}

function trimText(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed.length > 0 ? trimmed : null
}

function shopLabel(profile: CategoryTopShopProfileRow): string {
  return trimText(profile.shop_name) || trimText(profile.display_name) || "Seller"
}

function profileUsesOwnImage(profile: CategoryTopShopProfileRow): boolean {
  if (profile.is_shop && trimText(profile.shop_logo_url)) return true
  return Boolean(trimText(profile.avatar_url))
}

function locationLabelFromListings(
  listings: CategoryTopShopListingRow[],
  profileCity: string | null,
): string | null {
  const tileMeta = deriveSellerDirectoryTileMeta(listings)
  if (tileMeta.shipFromState) return tileMeta.shipFromState
  const locatedIn = tileMeta.locatedInLabel
  if (locatedIn?.startsWith("Located in ")) {
    return locatedIn.slice("Located in ".length)
  }
  return trimText(profileCity)
}

export function buildCategoryTopShopCandidates(
  sales: CategoryTopShopCompletedSaleRow[],
): CategoryTopShopCandidate[] {
  const bySeller = new Map<string, CategoryTopShopCandidate>()

  for (const sale of sales) {
    const existing = bySeller.get(sale.sellerId)
    if (existing) {
      existing.soldCount += 1
      if (sale.fulfillmentMethod === "shipping") existing.hasCompletedShipping = true
      if (sale.fulfillmentMethod === "pickup") existing.hasCompletedPickup = true
      continue
    }
    bySeller.set(sale.sellerId, {
      id: sale.sellerId,
      soldCount: 1,
      hasCompletedShipping: sale.fulfillmentMethod === "shipping",
      hasCompletedPickup: sale.fulfillmentMethod === "pickup",
    })
  }

  return [...bySeller.values()]
}

export async function listCategoryTopShops(
  supabase: SupabaseClient,
  section: CategoryTopShopSection,
): Promise<CategoryTopShop[]> {
  const [sales, demotedOrder] = await Promise.all([
    listCategoryCompletedFulfillmentSales(supabase, section),
    listSellersDirectoryDemotedProfileIdsOrdered(supabase),
  ])

  const candidates = buildCategoryTopShopCandidates(sales)
  if (candidates.length === 0) return []

  const ranked = orderSellersWithDemotions(candidates, demotedOrder, (shop) => ({
    id: shop.id,
    sales_count: shop.soldCount,
    inventoryCount: shop.hasCompletedShipping ? 1 : 0,
  }))

  const shortlist = ranked.slice(0, CANDIDATE_FETCH_BUFFER)
  const shortlistIds = shortlist.map((shop) => shop.id)

  const [profiles, reviewRows, activeListings, soldListings] = await Promise.all([
    listCategoryTopShopProfiles(supabase, shortlistIds),
    listCategoryTopShopReviewRows(supabase, shortlistIds),
    listCategoryListingsForSellers(supabase, section, shortlistIds, "active"),
    listCategoryListingsForSellers(supabase, section, shortlistIds, "sold"),
  ])

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const reviewsBySeller = new Map<string, { rating: number }[]>()
  for (const row of reviewRows) {
    const list = reviewsBySeller.get(row.reviewed_id) ?? []
    list.push({ rating: row.rating })
    reviewsBySeller.set(row.reviewed_id, list)
  }

  const listingsBySeller = new Map<string, CategoryTopShopListingRow[]>()
  for (const row of [...activeListings, ...soldListings]) {
    const list = listingsBySeller.get(row.user_id) ?? []
    list.push(row)
    listingsBySeller.set(row.user_id, list)
  }

  const shops: CategoryTopShop[] = []
  for (const candidate of shortlist) {
    const profile = profileById.get(candidate.id)
    if (!profile?.seller_slug?.trim()) continue

    const listings = listingsBySeller.get(candidate.id) ?? []
    const { avgRating, reviewCount } = summarizeSellerReviews(reviewsBySeller.get(candidate.id))

    shops.push({
      id: profile.id,
      href: sellerProfileHref(profile),
      name: shopLabel(profile),
      locationLabel: locationLabelFromListings(listings, profile.city),
      imageSrc: resolveSellerProfileDisplayImageUrl(profile, listings),
      imageFit: profileUsesOwnImage(profile) ? "contain" : "cover",
      avgRating,
      reviewCount,
      shopVerified: profile.shop_verified === true,
      completedShipping: candidate.hasCompletedShipping,
    })

    if (shops.length >= CATEGORY_TOP_SHOPS_LIMIT) break
  }

  return shops
}

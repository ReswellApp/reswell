import {
  mobileSellerCardSchema,
  mobileSellerPageSchema,
  mobileSellersPageSchema,
  type MobileListingCard,
  type MobileSellerPage,
  type MobileSellersPage,
} from "@reswell/api-contract"
import { getCachedSellersDirectoryCatalog } from "@/lib/cache/sellers-directory-catalog"
import { listMobileListingRows } from "@/lib/db/mobile-listings"
import { filterSellersDirectoryCatalog } from "@/lib/sellers/directory-catalog-filter"
import { sellersDirectoryPageCopy, sellersDirectorySummary } from "@/lib/sellers/directory-page-copy"
import { absoluteProfileCircleUrl } from "@/lib/profile-circle"
import { absolutePublicMediaUrl } from "@/lib/site-metadata"
import {
  followingSellerIdsForViewer,
  getMobileProfileService,
  toMobileListingCard,
  type MobileApiResult,
} from "@/lib/services/mobileApi"
import type { SupabaseClient } from "@supabase/supabase-js"

function mediaUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return absolutePublicMediaUrl(trimmed) ?? null
}

function inventoryLabel(count: number, sales: number | null | undefined): string | null {
  if (count > 0) return `${count} for sale`
  const sold = typeof sales === "number" && Number.isFinite(sales) ? Math.floor(sales) : 0
  if (sold > 0) return `${sold} sale${sold === 1 ? "" : "s"}`
  return null
}

function roundRating(value: number): number {
  return Math.round(value * 10) / 10
}

export async function getMobileSellersPageService(
  query: string | undefined,
  viewer?: { supabase: SupabaseClient; userId: string },
): Promise<MobileApiResult<MobileSellersPage>> {
  const catalog = await getCachedSellersDirectoryCatalog()
  const filtered = filterSellersDirectoryCatalog(catalog, query)
  const searching = Boolean(query?.trim())

  const sellerIds = filtered.items.map((item) => item.shop.id)
  const followingIds =
    viewer != null ? await followingSellerIdsForViewer(viewer.supabase, viewer.userId, sellerIds) : new Set<string>()

  const sellers = []
  for (const item of filtered.items) {
    const slug = item.shop.seller_slug?.trim()
    if (!slug) continue
    const name = item.shop.shop_name?.trim() || item.shop.display_name?.trim() || "Seller"
    const location = item.tileMeta.locationShort?.trim() || null
    const specialtyLine = item.tileMeta.specialtyLine?.trim() || null
    const shippingLine = item.tileMeta.shippingLine?.trim() || null
    const stockLine = inventoryLabel(item.inventoryCount, item.shop.sales_count)
    const lines = [location, specialtyLine, shippingLine, stockLine].filter(
      (line): line is string => Boolean(line),
    )
    const imageUrls = item.mosaicSlots
      .map((slot) => mediaUrl(slot.candidates[0]))
      .filter((url): url is string => Boolean(url))
      .slice(0, 3)
    const isOwnProfile = viewer?.userId === item.shop.id
    const card = {
      id: item.shop.id,
      slug,
      name,
      verified: item.shop.shop_verified === true,
      is_shop: item.shop.is_shop === true,
      avatar_url: absoluteProfileCircleUrl(item.avatarSrc),
      image_urls: imageUrls,
      display_banners: item.displayBanners,
      rating_average: roundRating(item.avgRating),
      review_count: item.reviewCount,
      location,
      specialty_line: specialtyLine,
      inventory_line: stockLine,
      shipping_line: shippingLine,
      offers_shipping: item.tileMeta.offersShipping === true,
      lines,
      show_follow: !isOwnProfile,
      ...(viewer && !isOwnProfile ? { following: followingIds.has(item.shop.id) } : {}),
    }
    const parsed = mobileSellerCardSchema.safeParse(card)
    if (parsed.success) sellers.push(parsed.data)
  }

  const page = mobileSellersPageSchema.safeParse({
    title: sellersDirectoryPageCopy.title,
    description: sellersDirectoryPageCopy.description,
    search_placeholder: sellersDirectoryPageCopy.searchPlaceholder,
    summary: sellersDirectorySummary(sellers.length, filtered.totalInventory),
    empty_title: sellersDirectoryPageCopy.emptyTitle,
    empty_body: searching ? sellersDirectoryPageCopy.emptySearchBody : sellersDirectoryPageCopy.emptyBody,
    sellers,
  })
  if (!page.success) {
    console.error("[mobile-api] sellers shape failed", { timestamp: new Date().toISOString() })
    return { ok: false, status: 500, error: "Unable to load sellers right now" }
  }
  return { ok: true, data: page.data }
}

export async function getMobileSellerPageService(
  slug: string,
  viewer?: { supabase: SupabaseClient; userId: string },
): Promise<MobileApiResult<MobileSellerPage>> {
  const profile = await getMobileProfileService(slug, viewer)
  if (!profile.ok) return profile

  const listed = await listMobileListingRows({
    limit: 20,
    offset: 0,
    sellerId: profile.data.id,
    availability: "current",
  })
  if (!listed.ok) {
    console.error("[mobile-api] seller listings failed", {
      timestamp: new Date().toISOString(),
      message: listed.message,
    })
    return { ok: false, status: 500, error: "Unable to load this seller right now" }
  }

  const listings: MobileListingCard[] = []
  for (const row of listed.rows) {
    const card = toMobileListingCard(row)
    if (card) listings.push(card)
  }

  const page = mobileSellerPageSchema.safeParse({ profile: profile.data, listings })
  if (!page.success) {
    return { ok: false, status: 500, error: "Unable to load this seller right now" }
  }
  return { ok: true, data: page.data }
}

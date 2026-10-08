import {
  mobileListingCardSchema,
  mobileListingDetailSchema,
  mobileMeSchema,
  mobileProfileSchema,
  type MobileListingCard,
  type MobileListingDetail,
  type MobileListingsPage,
  type MobileListingsQuery,
  type MobileMe,
  type MobileProfile,
} from "@reswell/api-contract"
import { fetchDashboardProfile } from "@/lib/db/dashboard-profile"
import {
  countMobileProfileListings,
  fetchMobileProfileBySlug,
  type MobileProfileRow,
} from "@/lib/db/mobile-profiles"
import {
  listMobileListingRows,
  MOBILE_LISTING_SELECT,
  type MobileListingRow,
  type MobileListingSellerRow,
} from "@/lib/db/mobile-listings"
import { isSellerBanActive } from "@/lib/db/sellerBan"
import { getSellerReviewSummary } from "@/lib/db/seller-reviews"
import { listingPickupCaption } from "@/lib/listing-fulfillment"
import {
  listingCardImageSrc,
  orderedListingGalleryImages,
} from "@/lib/listing-image-display"
import { formatCondition, formatHomePeerListingConditionLine, capitalizeWords, getPublicSellerDisplayName } from "@/lib/listing-labels"
import { peerListingShippingSubline } from "@/lib/listing-pdp-price-line"
import { findListingByParam } from "@/lib/listing-query"
import { isListingPubliclyVisible } from "@/lib/listing-public-visibility"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { absoluteProxiedProfileMediaUrl } from "@/lib/public-media-display-src"
import { configuredReswellShopOwnerUserId } from "@/lib/services/resolveReswellShopOwnerUser"
import { absolutePublicMediaUrl } from "@/lib/site-metadata"
import { getDb } from "@/lib/supabase/db"
import type { SupabaseClient, User } from "@supabase/supabase-js"

export type MobileApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

function moneyUsd(value: number | string | null | undefined): number {
  if (value == null) return 0
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100) / 100
}

function mediaUrl(path: string | null | undefined): string | null {
  const trimmed = path?.trim()
  if (!trimmed) return null
  return absolutePublicMediaUrl(trimmed) ?? null
}

function pickSeller(
  profiles: MobileListingRow["profiles"],
): MobileListingSellerRow | null {
  if (!profiles) return null
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles
}

function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function listingPriceLabel(priceUsd: number): string {
  return `$${priceUsd.toFixed(2)}`
}

function shippingCostMode(
  value: string | null | undefined,
): "reswell" | "flat" | "free" | null {
  if (value === "reswell" || value === "flat" || value === "free") return value
  return null
}

export function toMobileListingCard(row: MobileListingRow): MobileListingCard | null {
  const priceUsd = moneyUsd(row.price)
  const condition = nullableText(row.condition)
  const conditionLabel = condition ? formatCondition(condition) : ""
  const place = [nullableText(row.city), nullableText(row.state)].filter(Boolean).join(", ")
  const card = {
    id: row.id,
    slug: nullableText(row.slug),
    title: capitalizeWords(row.title) || "Untitled listing",
    brand: nullableText(row.brand),
    model: nullableText(row.model),
    condition,
    condition_label: conditionLabel || null,
    condition_line: formatHomePeerListingConditionLine(row.condition),
    section: nullableText(row.section) ?? "other",
    board_type: nullableText(row.board_type),
    dimensions: nullableText(row.dimensions),
    price_usd: priceUsd,
    price_cents: Math.round(priceUsd * 100),
    price_label: listingPriceLabel(priceUsd),
    city: nullableText(row.city),
    state: nullableText(row.state),
    shipping_available: Boolean(row.shipping_available),
    local_pickup: Boolean(row.local_pickup),
    image_url: mediaUrl(listingCardImageSrc(row.listing_images)),
    shipping_label: peerListingShippingSubline(
      row.local_pickup,
      row.shipping_available,
      row.shipping_price,
      shippingCostMode(row.board_shipping_cost_mode),
    ),
    pickup_label: listingPickupCaption(row.local_pickup !== false, place || null),
  }
  const parsed = mobileListingCardSchema.safeParse(card)
  if (!parsed.success) return null
  return parsed.data
}

export function toMobileListingDetail(
  row: MobileListingRow,
  viewer?: { favorited: boolean; in_cart: boolean },
): MobileListingDetail | null {
  const card = toMobileListingCard(row)
  if (!card) return null
  const seller = pickSeller(row.profiles)
  const imageUrls: string[] = []
  const seen = new Set<string>()
  for (const image of orderedListingGalleryImages(row.listing_images)) {
    const url = mediaUrl(image.url) ?? mediaUrl(image.thumbnail_url)
    if (!url || seen.has(url)) continue
    seen.add(url)
    imageUrls.push(url)
    if (imageUrls.length >= 12) break
  }
  const detail = {
    ...card,
    status: row.status,
    description: nullableText(row.description),
    image_urls: imageUrls,
    seller: {
      name: getPublicSellerDisplayName(seller),
      seller_slug: nullableText(seller?.seller_slug),
    },
    ...(viewer ? { favorited: viewer.favorited, in_cart: viewer.in_cart } : {}),
  }
  const parsed = mobileListingDetailSchema.safeParse(detail)
  if (!parsed.success) return null
  return parsed.data
}

export async function getMobileMeService(
  supabase: SupabaseClient,
  user: User,
): Promise<MobileApiResult<MobileMe>> {
  const profileResult = await fetchDashboardProfile(supabase, user.id)
  if (profileResult.error && profileResult.error !== "Profile not found") {
    console.error("[mobile-api] profile failed", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      message: profileResult.error,
    })
    return { ok: false, status: 500, error: "Unable to load your account right now" }
  }

  const profile = profileResult.profile
  const me = {
    id: user.id,
    email: nullableText(user.email),
    display_name: nullableText(profile?.display_name) ?? "Reswell member",
    seller_slug: nullableText(profile?.seller_slug),
    avatar_url: mediaUrl(profile?.avatar_url),
  }
  const parsed = mobileMeSchema.safeParse(me)
  if (!parsed.success) {
    console.error("[mobile-api] me shape failed", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    })
    return { ok: false, status: 500, error: "Unable to load your account right now" }
  }
  return { ok: true, data: parsed.data }
}

export async function listMobileListingsService(
  query: MobileListingsQuery,
): Promise<MobileApiResult<MobileListingsPage>> {
  const requestedSection = (query.category ?? query.section)?.trim()
  if (requestedSection && !isPeerListingSection(requestedSection)) {
    return { ok: false, status: 400, error: "Invalid listings query" }
  }
  if (query.board_type && requestedSection && requestedSection !== "surfboards") {
    return { ok: false, status: 400, error: "Invalid listings query" }
  }

  const listed = await listMobileListingRows({
    limit: query.limit,
    offset: query.offset,
    q: query.q?.trim() || undefined,
    section: query.board_type ? "surfboards" : requestedSection || undefined,
    boardType: query.board_type,
  })
  if (!listed.ok) {
    console.error("[mobile-api] listings failed", {
      timestamp: new Date().toISOString(),
      message: listed.message,
    })
    return { ok: false, status: 500, error: "Unable to load listings right now" }
  }

  const listings: MobileListingCard[] = []
  for (const row of listed.rows) {
    if (!isListingPubliclyVisible(row)) continue
    const card = toMobileListingCard(row)
    if (card) listings.push(card)
  }

  return {
    ok: true,
    data: {
      listings,
      limit: query.limit,
      offset: query.offset,
      has_more: listed.hasMore,
    },
  }
}

function publicHttpUrl(value: string | null | undefined): string | null {
  const trimmed = nullableText(value)
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

function profileMedia(value: string | null | undefined): string | null {
  const trimmed = nullableText(value)
  if (!trimmed) return null
  return absoluteProxiedProfileMediaUrl(trimmed) ?? null
}

function countOrZero(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value < 0) return 0
  return Math.floor(value)
}

export function toMobileProfile(
  row: MobileProfileRow,
  stats: { listingCount: number; ratingAverage: number; reviewCount: number; following?: boolean },
): MobileProfile | null {
  const slug = nullableText(row.seller_slug)
  if (!slug) return null

  const isShop = Boolean(row.is_shop)
  const name =
    (isShop ? nullableText(row.shop_name) ?? nullableText(row.display_name) : nullableText(row.display_name)) ??
    "Reswell member"
  const joined = new Date(row.created_at)
  if (Number.isNaN(joined.getTime())) return null

  const city = nullableText(row.city)
  const profile = {
    id: row.id,
    seller_slug: slug,
    name,
    is_shop: isShop,
    about: nullableText(row.shop_description) ?? nullableText(row.bio),
    city,
    location_label: nullableText(row.shop_address) ?? city ?? nullableText(row.location),
    avatar_url: isShop
      ? profileMedia(row.shop_logo_url) ?? profileMedia(row.avatar_url)
      : profileMedia(row.avatar_url),
    banner_url: profileMedia(row.shop_banner_url),
    verified: isShop && Boolean(row.shop_verified),
    website_url: publicHttpUrl(row.shop_website),
    phone: nullableText(row.shop_phone),
    sales_count: countOrZero(row.sales_count),
    follower_count: countOrZero(row.follower_count),
    listing_count: countOrZero(stats.listingCount),
    rating_average: Math.min(5, Math.max(0, stats.ratingAverage)),
    review_count: countOrZero(stats.reviewCount),
    member_since: joined.toISOString(),
    member_since_label: new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(joined),
    ...(stats.following == null ? {} : { following: stats.following }),
  }

  const parsed = mobileProfileSchema.safeParse(profile)
  if (!parsed.success) return null
  return parsed.data
}

export async function loadPublicMobileProfileRow(
  slug: string,
): Promise<MobileApiResult<MobileProfileRow>> {
  const found = await fetchMobileProfileBySlug(slug)
  if (!found.ok) {
    console.error("[mobile-api] profile failed", {
      timestamp: new Date().toISOString(),
      message: found.message,
    })
    return { ok: false, status: 500, error: "Unable to load profile right now" }
  }

  const row = found.row
  if (!row || isSellerBanActive({ sellerBannedAt: row.seller_banned_at, sellerBannedReason: null })) {
    return { ok: false, status: 404, error: "Profile not found" }
  }
  if (configuredReswellShopOwnerUserId() === row.id) {
    return { ok: false, status: 404, error: "Profile not found" }
  }
  return { ok: true, data: row }
}

export async function getMobileProfileService(
  slug: string,
  viewer?: { supabase: SupabaseClient; userId: string },
): Promise<MobileApiResult<MobileProfile>> {
  const loaded = await loadPublicMobileProfileRow(slug)
  if (!loaded.ok) return loaded
  const row = loaded.data

  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const [reviews, listings] = await Promise.all([
    getSellerReviewSummary(supabase, row.id),
    countMobileProfileListings(row.id),
  ])
  if (!listings.ok) {
    console.error("[mobile-api] profile listings failed", {
      timestamp: new Date().toISOString(),
      message: listings.message,
    })
    return { ok: false, status: 500, error: "Unable to load profile right now" }
  }

  let following: boolean | undefined
  if (viewer) {
    const { data: follow } = await viewer.supabase
      .from("seller_follows")
      .select("id")
      .eq("follower_id", viewer.userId)
      .eq("seller_id", row.id)
      .maybeSingle()
    following = Boolean(follow)
  }

  const profile = toMobileProfile(row, {
    listingCount: listings.count,
    ratingAverage: reviews.data.avgRating,
    reviewCount: reviews.data.reviewCount,
    following,
  })
  if (!profile) {
    return { ok: false, status: 500, error: "Unable to load profile right now" }
  }
  return { ok: true, data: profile }
}

export async function getMobileListingService(
  listingParam: string,
  viewer?: { supabase: SupabaseClient; userId: string },
): Promise<MobileApiResult<MobileListingDetail>> {
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const found = await findListingByParam(supabase, listingParam, {
    select: MOBILE_LISTING_SELECT,
  })
  if (found.queryFailed) {
    return { ok: false, status: 500, error: "Unable to load listing right now" }
  }

  const row = found.listing as MobileListingRow | null
  if (!row || !isListingPubliclyVisible(row)) {
    return { ok: false, status: 404, error: "Listing not found" }
  }

  let viewerState: { favorited: boolean; in_cart: boolean } | undefined
  if (viewer) {
    const [favorite, cart] = await Promise.all([
      viewer.supabase
        .from("favorites")
        .select("id")
        .eq("user_id", viewer.userId)
        .eq("listing_id", row.id)
        .maybeSingle(),
      viewer.supabase
        .from("cart_items")
        .select("id")
        .eq("profile_id", viewer.userId)
        .eq("listing_id", row.id)
        .maybeSingle(),
    ])
    viewerState = { favorited: Boolean(favorite.data), in_cart: Boolean(cart.data) }
  }

  const detail = toMobileListingDetail(row, viewerState)
  if (!detail) {
    return { ok: false, status: 500, error: "Unable to load listing right now" }
  }
  return { ok: true, data: detail }
}

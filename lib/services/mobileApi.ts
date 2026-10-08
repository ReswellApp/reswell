import {
  mobileListingCardSchema,
  mobileListingDetailSchema,
  mobileMeSchema,
  type MobileListingCard,
  type MobileListingDetail,
  type MobileListingsPage,
  type MobileMe,
} from "@reswell/api-contract"
import { fetchDashboardProfile } from "@/lib/db/dashboard-profile"
import {
  listMobileListingRows,
  MOBILE_LISTING_SELECT,
  type MobileListingRow,
  type MobileListingSellerRow,
} from "@/lib/db/mobile-listings"
import {
  listingCardImageSrc,
  orderedListingGalleryImages,
} from "@/lib/listing-image-display"
import { formatCondition, formatHomePeerListingConditionLine, capitalizeWords, getPublicSellerDisplayName } from "@/lib/listing-labels"
import { listingPickupCaption } from "@/lib/listing-fulfillment"
import { peerListingShippingSubline } from "@/lib/listing-pdp-price-line"
import { findListingByParam } from "@/lib/listing-query"
import { isListingPubliclyVisible } from "@/lib/listing-public-visibility"
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

export function toMobileListingDetail(row: MobileListingRow): MobileListingDetail | null {
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
  limit: number,
  offset: number,
): Promise<MobileApiResult<MobileListingsPage>> {
  const listed = await listMobileListingRows(limit, offset)
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
    data: { listings, limit, offset, has_more: listed.hasMore },
  }
}

export async function getMobileListingService(
  listingParam: string,
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

  const detail = toMobileListingDetail(row)
  if (!detail) {
    return { ok: false, status: 500, error: "Unable to load listing right now" }
  }
  return { ok: true, data: detail }
}

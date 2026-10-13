import type { SupabaseClient } from "@supabase/supabase-js"

import { listingDetailHref } from "@/lib/listing-href"
import { listingTitleThumbnailSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { capitalizeWords } from "@/lib/listing-labels"

export interface EarningsOrderListingRow {
  orderId: string
  orderNum: string | null
  sellerEarningsUsd: number | null
  listing: {
    id: string
    title: string
    href: string
    imageUrl: string | null
    extraListingCount: number
  } | null
}

type ListingImageEmbed = {
  url?: string | null
  thumbnail_url?: string | null
  is_primary?: boolean | null
  sort_order?: number | null
}

type ListingEmbed = {
  id?: string | null
  title?: string | null
  slug?: string | null
  section?: string | null
  listing_images?: ListingImageEmbed[] | ListingImageEmbed | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asListingEmbed(value: unknown): ListingEmbed | null {
  const row = Array.isArray(value) ? asRecord(value[0]) : asRecord(value)
  if (!row) return null
  return {
    id: typeof row.id === "string" ? row.id : null,
    title: typeof row.title === "string" ? row.title : null,
    slug: typeof row.slug === "string" ? row.slug : null,
    section: typeof row.section === "string" ? row.section : null,
    listing_images: row.listing_images as ListingEmbed["listing_images"],
  }
}

function listingImagesForCard(raw: ListingEmbed["listing_images"]): ListingImageForCard[] | null {
  if (!raw) return null
  const rows = Array.isArray(raw) ? raw : [raw]
  const images: ListingImageForCard[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    images.push({
      url: typeof row.url === "string" ? row.url : null,
      thumbnail_url: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
      is_primary: typeof row.is_primary === "boolean" ? row.is_primary : null,
    })
  }
  return images.length > 0 ? images : null
}

function toListingRef(embed: ListingEmbed | null): EarningsOrderListingRow["listing"] {
  const id = embed?.id?.trim() ?? ""
  if (!id) return null
  const title = capitalizeWords(embed?.title) || "Listing"
  const href = listingDetailHref({
    id,
    slug: embed?.slug ?? undefined,
    section: embed?.section ?? undefined,
  })
  const imageUrl = listingTitleThumbnailSrc(listingImagesForCard(embed?.listing_images)) || null
  return { id, title, href, imageUrl, extraListingCount: 0 }
}

const LISTING_EMBED =
  "id, title, slug, section, listing_images(url, thumbnail_url, is_primary, sort_order)"

/**
 * Batch-load the sold listing (and extras) for marketplace seller ledger rows.
 * Scoped to the signed-in seller via RLS on `orders`.
 */
export async function fetchEarningsListingsForOrderIds(
  supabase: SupabaseClient,
  orderIds: string[],
): Promise<Map<string, EarningsOrderListingRow>> {
  const uniqueIds = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))]
  const result = new Map<string, EarningsOrderListingRow>()
  if (uniqueIds.length === 0) return result

  const [ordersRes, itemsRes] = await Promise.all([
    supabase
      .from("orders")
      .select(`id, order_num, listing_id, seller_earnings, listings(${LISTING_EMBED})`)
      .in("id", uniqueIds),
    supabase
      .from("order_items")
      .select(`order_id, listing_id, listings(${LISTING_EMBED})`)
      .in("order_id", uniqueIds),
  ])

  if (ordersRes.error) {
    console.error("[earningsActivityListings] orders:", ordersRes.error.message)
  }
  if (itemsRes.error) {
    console.error("[earningsActivityListings] order_items:", itemsRes.error.message)
  }

  const extrasByOrder = new Map<string, ListingEmbed[]>()
  for (const raw of itemsRes.data ?? []) {
    const row = asRecord(raw)
    if (!row) continue
    const orderId = typeof row.order_id === "string" ? row.order_id : ""
    const embed = asListingEmbed(row.listings)
    if (!orderId || !embed?.id) continue
    const bucket = extrasByOrder.get(orderId) ?? []
    bucket.push(embed)
    extrasByOrder.set(orderId, bucket)
  }

  for (const raw of ordersRes.data ?? []) {
    const row = asRecord(raw)
    if (!row) continue
    const orderId = typeof row.id === "string" ? row.id : ""
    if (!orderId) continue

    const primary = asListingEmbed(row.listings)
    const extras = extrasByOrder.get(orderId) ?? []
    const extraDistinct = extras.filter((item) => item.id && item.id !== primary?.id)
    const listing = toListingRef(primary ?? extraDistinct[0] ?? null)
    if (listing) {
      listing.extraListingCount = primary ? extraDistinct.length : Math.max(0, extraDistinct.length - 1)
    }

    const earningsRaw = row.seller_earnings
    const earningsNum =
      typeof earningsRaw === "number"
        ? earningsRaw
        : typeof earningsRaw === "string"
          ? parseFloat(earningsRaw)
          : NaN

    result.set(orderId, {
      orderId,
      orderNum: typeof row.order_num === "string" ? row.order_num : null,
      sellerEarningsUsd: Number.isFinite(earningsNum) ? earningsNum : null,
      listing,
    })
  }

  for (const [orderId, extras] of extrasByOrder) {
    if (result.has(orderId) || extras.length === 0) continue
    const listing = toListingRef(extras[0] ?? null)
    if (listing) listing.extraListingCount = Math.max(0, extras.length - 1)
    result.set(orderId, {
      orderId,
      orderNum: null,
      sellerEarningsUsd: null,
      listing,
    })
  }

  return result
}

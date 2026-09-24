import type { SupabaseClient } from "@supabase/supabase-js"

import type { KlaviyoListingImage } from "@/lib/klaviyo/catalog-product"
import { findSentKlaviyoUniqueIds } from "@/lib/db/klaviyoEventLog"
import {
  OFFER_EXPIRING_LEAD_MS,
  offerIsInExpiringWindow,
} from "@/lib/klaviyo/marketplace-nudge-windows"
import { trackKlaviyoOfferExpiring } from "@/lib/klaviyo/track-marketplace-nudge"

const BATCH_LIMIT = 200

export type OfferExpiringSummary = {
  eligible: number
  emitted: number
  skipped: number
  failed: number
}

type ImageRow = KlaviyoListingImage

type ListingEmbed = {
  id: string
  title: string | null
  slug: string | null
  section: string | null
  price: number | string | null
  status: string | null
  listing_images: ImageRow[] | null
}

type OfferRow = {
  id: string
  buyer_id: string
  seller_id: string
  status: string
  current_amount: number | string
  expires_at: string
  listings: ListingEmbed | ListingEmbed[] | null
}

function oneListing(value: OfferRow["listings"]): ListingEmbed | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function uniqueIdFor(status: string, offerId: string): string | null {
  if (status === "PENDING") return `offer-expiring-seller-${offerId}`
  if (status === "COUNTERED") return `offer-expiring-buyer-${offerId}`
  return null
}

/**
 * Emits **Offer Expiring** once inside the last 12 hours of a pending or countered offer.
 * Pending notifies the seller. Countered notifies the buyer. Accepted offers are left
 * to the Offer Accepted reminder flow.
 */
export async function processKlaviyoOfferExpiring(
  supabase: SupabaseClient,
  referenceTime: Date,
): Promise<OfferExpiringSummary> {
  const summary: OfferExpiringSummary = {
    eligible: 0,
    emitted: 0,
    skipped: 0,
    failed: 0,
  }

  const horizon = new Date(referenceTime.getTime() + OFFER_EXPIRING_LEAD_MS).toISOString()
  const { data, error } = await supabase
    .from("offers")
    .select(
      `
      id, buyer_id, seller_id, status, current_amount, expires_at,
      listings ( id, title, slug, section, price, status, listing_images (url, thumbnail_url, is_primary, sort_order) )
    `,
    )
    .in("status", ["PENDING", "COUNTERED"])
    .gt("expires_at", referenceTime.toISOString())
    .lte("expires_at", horizon)
    .limit(BATCH_LIMIT)

  if (error) {
    console.error("[klaviyoOfferExpiring] select:", error.message)
    throw new Error(error.message)
  }

  const rows = (data ?? []) as OfferRow[]
  const candidates = rows.filter((row) => {
    if (!offerIsInExpiringWindow(row.expires_at, referenceTime)) return false
    const listing = oneListing(row.listings)
    return listing?.status === "active"
  })

  const uniqueIds = candidates
    .map((row) => uniqueIdFor(row.status, row.id))
    .filter((id): id is string => Boolean(id))
  const alreadySent = await findSentKlaviyoUniqueIds(uniqueIds)

  for (const row of candidates) {
    const uniqueId = uniqueIdFor(row.status, row.id)
    const listing = oneListing(row.listings)
    if (!uniqueId || !listing) {
      summary.skipped += 1
      continue
    }
    if (alreadySent.has(uniqueId)) {
      summary.skipped += 1
      continue
    }
    if (row.status !== "PENDING" && row.status !== "COUNTERED") {
      summary.skipped += 1
      continue
    }

    summary.eligible += 1
    const amount = Number(row.current_amount)
    const result = await trackKlaviyoOfferExpiring({
      offerId: row.id,
      status: row.status,
      buyerUserId: row.buyer_id,
      sellerUserId: row.seller_id,
      offerAmount: Number.isFinite(amount) ? amount : 0,
      expiresAt: row.expires_at,
      now: referenceTime,
      listing: {
        id: listing.id,
        title: listing.title?.trim() || "your listing",
        slug: listing.slug,
        section: listing.section,
        price: Number(listing.price),
        images: listing.listing_images,
      },
    })

    if (result.ok) summary.emitted += 1
    else if (result.skipped) summary.skipped += 1
    else summary.failed += 1
  }

  return summary
}

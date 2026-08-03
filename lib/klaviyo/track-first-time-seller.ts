/**
 * Server-only: Klaviyo Events API — first-time seller lifecycle metrics.
 *
 * Fires only when the seller has never published a non-draft listing in that
 * category before. Profile is the **seller**.
 *
 * **Category metrics (flow triggers):**
 * - `First Time Seller - Boards`
 * - `First Time Seller - Fins`
 * - `First Time Seller - Wetsuits`
 * - `First Time Seller - Magazines`
 * - `First Time Seller - Apparel`
 *
 * **Board fulfillment splits** (also fired for first board listing, based on
 * what the seller offered — same pattern as Shipping/Local Pickup Sale Received):
 * - `First Time Board Seller - Shipping Available` when `shipping_available`
 * - `First Time Board Seller - Local Pickup` when `local_pickup`
 *
 * For `pickup_and_shipping`, both board fulfillment metrics fire so Klaviyo
 * can run the matching educational flow(s). Deduped per seller via `unique_id`.
 *
 * Template variables: `{{ event.Title }}`, `{{ event.listing_url }}`,
 * `{{ event.Price }}`, `{{ event.section }}`, `{{ event.fulfillment_mode }}`,
 * `{{ event.local_pickup }}`, `{{ event.shipping_available }}`.
 */

import { absoluteKlaviyoListingPhotoUrl } from "@/lib/klaviyo/catalog-product"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { listingDetailHref } from "@/lib/listing-href"
import {
  boardFulfillmentFromFlags,
  boardFulfillmentSummary,
  type BoardFulfillmentChoice,
} from "@/lib/listing-fulfillment"
import {
  PEER_LISTING_SECTION_LABELS,
  type PeerListingSection,
} from "@/lib/peer-listing-sections"
import { publicSiteOrigin } from "@/lib/public-site-origin"

/** Sections that have a dedicated first-time seller Klaviyo flow. */
export const FIRST_TIME_SELLER_SECTIONS = [
  "surfboards",
  "fins",
  "wetsuits",
  "magazines",
  "apparel",
] as const satisfies readonly PeerListingSection[]

export type FirstTimeSellerSection = (typeof FIRST_TIME_SELLER_SECTIONS)[number]

const FIRST_TIME_SELLER_SECTION_SET = new Set<string>(FIRST_TIME_SELLER_SECTIONS)

export function isFirstTimeSellerSection(
  section: string | null | undefined,
): section is FirstTimeSellerSection {
  return section != null && FIRST_TIME_SELLER_SECTION_SET.has(section)
}

/** Klaviyo metric name for the category-level first-time seller trigger. */
export const FIRST_TIME_SELLER_METRIC_BY_SECTION: Record<FirstTimeSellerSection, string> = {
  surfboards: "First Time Seller - Boards",
  fins: "First Time Seller - Fins",
  wetsuits: "First Time Seller - Wetsuits",
  magazines: "First Time Seller - Magazines",
  apparel: "First Time Seller - Apparel",
}

export const FIRST_TIME_BOARD_SELLER_SHIPPING_METRIC =
  "First Time Board Seller - Shipping Available" as const

export const FIRST_TIME_BOARD_SELLER_LOCAL_PICKUP_METRIC =
  "First Time Board Seller - Local Pickup" as const

export type KlaviyoFirstTimeSellerPayload = {
  sellerUserId: string
  sellerEmail?: string | null
  listingId: string
  listingSlug?: string | null
  section: FirstTimeSellerSection
  title: string
  price: number
  photoUrl?: string | null
  localPickup?: boolean | null
  shippingAvailable?: boolean | null
}

function fulfillmentFields(
  localPickup: boolean | null | undefined,
  shippingAvailable: boolean | null | undefined,
): {
  local_pickup: boolean
  shipping_available: boolean
  fulfillment_mode: BoardFulfillmentChoice
  fulfillment_label: string
} {
  const local_pickup = localPickup !== false
  const shipping_available = !!shippingAvailable
  const fulfillment_mode = boardFulfillmentFromFlags(local_pickup, shipping_available)
  return {
    local_pickup,
    shipping_available,
    fulfillment_mode,
    fulfillment_label: boardFulfillmentSummary(local_pickup, shipping_available),
  }
}

function sharedProperties(payload: KlaviyoFirstTimeSellerPayload) {
  const priceNum = typeof payload.price === "number" ? payload.price : Number(payload.price)
  const fulfillment = fulfillmentFields(payload.localPickup, payload.shippingAvailable)
  const origin = publicSiteOrigin()
  const listingPath = listingDetailHref({
    id: payload.listingId,
    slug: payload.listingSlug ?? undefined,
    section: payload.section,
  })

  return {
    Created: true,
    first_time_in_category: true,
    section: payload.section,
    section_label: PEER_LISTING_SECTION_LABELS[payload.section],
    Title: payload.title,
    Price: Number.isFinite(priceNum) ? priceNum : payload.price,
    photo_url: payload.photoUrl ? absoluteKlaviyoListingPhotoUrl(payload.photoUrl) : "",
    listing_id: payload.listingId,
    listing_url: `${origin}${listingPath}`,
    local_pickup: fulfillment.local_pickup,
    shipping_available: fulfillment.shipping_available,
    fulfillment_mode: fulfillment.fulfillment_mode,
    fulfillment_label: fulfillment.fulfillment_label,
    priceNum: Number.isFinite(priceNum) ? priceNum : undefined,
  }
}

/**
 * Emits category first-time seller metric, plus board shipping / local-pickup
 * split metrics when applicable. Caller must already verify this is the seller's
 * first published listing in the section.
 */
export async function trackKlaviyoFirstTimeSeller(
  payload: KlaviyoFirstTimeSellerPayload,
): Promise<void> {
  const metricName = FIRST_TIME_SELLER_METRIC_BY_SECTION[payload.section]
  const props = sharedProperties(payload)
  const { priceNum, ...properties } = props

  const profile = {
    external_id: payload.sellerUserId,
    email: payload.sellerEmail,
  }

  await sendKlaviyoServerEvent({
    metricName,
    properties,
    profile,
    uniqueId: `first-time-seller-${payload.section}-${payload.sellerUserId}`,
    value: priceNum,
    valueCurrency: "USD",
  })

  if (payload.section !== "surfboards") return

  if (properties.shipping_available) {
    await sendKlaviyoServerEvent({
      metricName: FIRST_TIME_BOARD_SELLER_SHIPPING_METRIC,
      properties,
      profile,
      uniqueId: `first-time-board-seller-shipping-${payload.sellerUserId}`,
      value: priceNum,
      valueCurrency: "USD",
    })
  }

  if (properties.local_pickup) {
    await sendKlaviyoServerEvent({
      metricName: FIRST_TIME_BOARD_SELLER_LOCAL_PICKUP_METRIC,
      properties,
      profile,
      uniqueId: `first-time-board-seller-local-pickup-${payload.sellerUserId}`,
      value: priceNum,
      valueCurrency: "USD",
    })
  }
}

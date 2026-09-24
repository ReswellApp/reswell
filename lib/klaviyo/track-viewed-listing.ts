/**
 * Server-only: Klaviyo **Viewed Listing** — browse abandonment for `/l/{slug-or-id}`.
 *
 * Flow: Metric → Viewed Listing → delay 2 hours → email.
 * Filters: `listing_status` equals `active`, `is_own_listing` is not true.
 * Exit: Added to Cart, Checkout Started, Placed Order, or Listing Saved since the flow started.
 *
 * Replaces using **Viewed Site Page** for product views. That metric stays for the rest of the site
 * and should not drive a product email.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  absoluteKlaviyoListingImageUrl,
  formatKlaviyoPriceDisplay,
  klaviyoCommerceEventProperties,
  listingToKlaviyoEventCommerceItem,
  parseKlaviyoListingPrice,
  type KlaviyoListingImage,
  type KlaviyoListingProductSource,
} from "@/lib/klaviyo/catalog-product"
import { VIEWED_LISTING_METRIC } from "@/lib/klaviyo/marketplace-metrics"
import { listingIdentifierFromPathname } from "@/lib/klaviyo/page-view-path"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const LISTING_COLUMNS =
  "id, slug, title, price, section, status, user_id, listing_images(url, thumbnail_url, is_primary, sort_order)"

type ListingViewRow = KlaviyoListingProductSource & {
  status?: string | null
  user_id?: string | null
}

function oneRow(value: unknown): ListingViewRow | null {
  if (value == null) return null
  if (Array.isArray(value)) {
    const first = value[0]
    return first && typeof first === "object" ? (first as ListingViewRow) : null
  }
  if (typeof value === "object") return value as ListingViewRow
  return null
}

async function loadListing(
  supabase: SupabaseClient,
  identifier: string,
): Promise<ListingViewRow | null> {
  const column = UUID_RE.test(identifier) ? "id" : "slug"
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq(column, identifier)
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return oneRow(data)
}

export async function trackKlaviyoViewedListing(input: {
  pathname: string
  path: string
  search?: string
  userId: string | null
  email: string | null
  anonymousId: string | null
  supabase?: SupabaseClient
}): Promise<void> {
  const identifier = listingIdentifierFromPathname(input.pathname)
  const listing =
    identifier && input.supabase ? await loadListing(input.supabase, identifier) : null

  const images = Array.isArray(listing?.listing_images)
    ? (listing.listing_images as KlaviyoListingImage[])
    : null
  const price = listing ? parseKlaviyoListingPrice(listing.price) : null
  const commerce = listing
    ? listingToKlaviyoEventCommerceItem({
        ...listing,
        listing_images: images,
      })
    : null
  const photoUrl = listing ? absoluteKlaviyoListingImageUrl(listing) : ""
  const isOwn =
    Boolean(input.userId) && Boolean(listing?.user_id) && input.userId === listing?.user_id

  const profile =
    input.userId != null
      ? { external_id: input.userId, email: input.email }
      : { anonymous_id: input.anonymousId ?? undefined }

  await sendKlaviyoServerEvent({
    metricName: VIEWED_LISTING_METRIC,
    uniqueId: crypto.randomUUID(),
    profile,
    value: price ?? undefined,
    valueCurrency: price != null ? "USD" : undefined,
    properties: {
      ...(commerce
        ? klaviyoCommerceEventProperties({
            primaryProductId: commerce.ProductID,
            items: [commerce],
          })
        : {}),
      Path: input.path,
      Pathname: input.pathname,
      ...(input.search
        ? { Search: input.search.startsWith("?") ? input.search.slice(1) : input.search }
        : {}),
      "Page segment": "listing",
      Title: listing?.title?.trim() || "",
      listing_id: listing?.id ?? "",
      listing_status: listing?.status?.trim() || "unknown",
      price_display: formatKlaviyoPriceDisplay(price),
      photo_url: photoUrl,
      ProductURL: commerce?.ProductURL ?? "",
      ImageURL: commerce?.ImageURL ?? "",
      is_own_listing: isOwn,
    },
  })
}

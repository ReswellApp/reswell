/**
 * Server-only: Klaviyo **Viewed Product** — a visitor opened `/l/{slug-or-id}`.
 *
 * **Flow trigger:** Flows → Create flow → Metric → **Viewed Product**.
 * Product blocks use `ProductID` + `Items` (catalog `$id` is the listing UUID).
 * `listing_url` and `photo_url` are set when the public listing resolves.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import { fetchPublicListingForViewedProduct } from "@/lib/db/klaviyoViewedProductListing"
import {
  klaviyoCommerceEventProperties,
  listingToKlaviyoEventCommerceItem,
  parseKlaviyoListingPrice,
} from "@/lib/klaviyo/catalog-product"
import { listingParamFromProductPathname } from "@/lib/klaviyo/page-view-metric"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type TrackKlaviyoViewedProductInput = {
  pathname: string
  path: string
  search?: string
  userId: string | null
  email: string | null
  anonymousId: string | null
  supabase?: SupabaseClient
}

export async function trackKlaviyoViewedProduct(
  input: TrackKlaviyoViewedProductInput,
): Promise<void> {
  const listingParam = listingParamFromProductPathname(input.pathname)
  const listing =
    listingParam && input.supabase
      ? await fetchPublicListingForViewedProduct(input.supabase, listingParam)
      : null

  const search = input.search?.trim()
  const profile =
    input.userId != null
      ? { external_id: input.userId, email: input.email }
      : { anonymous_id: input.anonymousId ?? undefined }

  const price = listing ? parseKlaviyoListingPrice(listing.price) : null
  const commerceItem = listing ? listingToKlaviyoEventCommerceItem(listing) : null

  await sendKlaviyoServerEvent({
    metricName: "Viewed Product",
    uniqueId: crypto.randomUUID(),
    profile,
    value: price ?? undefined,
    valueCurrency: price != null ? "USD" : undefined,
    properties: {
      Path: input.path,
      Pathname: input.pathname,
      ...(search ? { Search: search.startsWith("?") ? search.slice(1) : search } : {}),
      "Page segment": "product",
      ...(listingParam ? { "Listing param": listingParam } : {}),
      ...(listing && commerceItem
        ? {
            ...klaviyoCommerceEventProperties({
              primaryProductId: listing.id,
              items: [commerceItem],
            }),
            listing_id: listing.id,
            Title: commerceItem.ProductName,
            Price: price,
            photo_url: commerceItem.ImageURL,
            listing_url: commerceItem.ProductURL,
            section: listing.section ?? "",
            brand: listing.brand ?? "",
          }
        : {}),
    },
  })
}

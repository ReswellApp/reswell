import type { SupabaseClient } from "@supabase/supabase-js"
import { listShippableSurfboardMerchantListingBatch } from "@/lib/db/google-merchant-listings"
import {
  GOOGLE_MERCHANT_SHIPPING_CUSTOM_LABEL,
  getGoogleMerchantShippableSurfboardsFeedLabel,
} from "@/lib/google-merchant/config"
import {
  isShippableSurfboardGoogleMerchantListing,
  mapListingToProductInput,
  type GoogleMerchantProductInputPayload,
} from "@/lib/google-merchant/map-listing-to-product-input"
import { googleMerchantProductInputsToTsv } from "@/lib/google-merchant/product-feed-tsv"
import { resolveGoogleMerchantOutSurfingShopUserId } from "@/lib/services/googleMerchantSync"

const DEFAULT_MAX_ITEMS = 10_000

function catalogFeedMaxItems(): number {
  const raw = process.env.GOOGLE_MERCHANT_CATALOG_FEED_MAX_ITEMS?.trim()
  if (!raw) return DEFAULT_MAX_ITEMS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MAX_ITEMS
  return Math.min(parsed, 50_000)
}

export async function buildGoogleShippableSurfboardProductInputs(
  supabase: SupabaseClient,
): Promise<GoogleMerchantProductInputPayload[]> {
  const maxItems = catalogFeedMaxItems()
  const outSurfingShopUserId = await resolveGoogleMerchantOutSurfingShopUserId(supabase)
  const context = { outSurfingShopUserId }
  const feedLabel = getGoogleMerchantShippableSurfboardsFeedLabel()
  const items: GoogleMerchantProductInputPayload[] = []
  const pageSize = 100
  let from = 0

  while (items.length < maxItems) {
    const batch = await listShippableSurfboardMerchantListingBatch(supabase, {
      from,
      limit: pageSize,
    })
    if (batch.length === 0) break

    for (const listing of batch) {
      if (items.length >= maxItems) break
      if (!isShippableSurfboardGoogleMerchantListing(listing)) continue
      const product = mapListingToProductInput(listing, context, {
        feedLabel,
        customLabel2: GOOGLE_MERCHANT_SHIPPING_CUSTOM_LABEL,
      })
      if (product) items.push(product)
    }

    if (batch.length < pageSize) break
    from += pageSize
  }

  return items
}

export async function buildGoogleShippableSurfboardFeedTsv(
  supabase: SupabaseClient,
): Promise<string> {
  const items = await buildGoogleShippableSurfboardProductInputs(supabase)
  return googleMerchantProductInputsToTsv(items)
}

export function isGoogleMerchantCatalogFeedAuthorized(request: Request): boolean {
  const secret = process.env.GOOGLE_MERCHANT_CATALOG_FEED_SECRET?.trim()
  if (!secret) return true

  const url = new URL(request.url)
  const tokenParam = url.searchParams.get("token")?.trim()
  if (tokenParam && tokenParam === secret) return true

  const authHeader = request.headers.get("authorization")?.trim()
  if (authHeader === `Bearer ${secret}`) return true

  return false
}

export type GoogleMerchantCatalogFeedFormat = "tsv" | "json"

export function resolveGoogleMerchantCatalogFeedFormat(
  request: Request,
): GoogleMerchantCatalogFeedFormat {
  const url = new URL(request.url)
  const formatParam = url.searchParams.get("format")?.trim().toLowerCase()
  if (formatParam === "json") return "json"
  return "tsv"
}

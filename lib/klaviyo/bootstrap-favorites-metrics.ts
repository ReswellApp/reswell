/**
 * Sends one minimal Events API event per favorites metric so Klaviyo lists them under
 * **Flows → Your metrics → API** before real traffic.
 *
 * Uses synthetic profile `reswell-metric-seed-favorites` and `reswell_metric_seed: true`.
 */

import "@/lib/klaviyo/bootstrap-env"
import {
  FAVORITE_PRICE_DROP_METRIC,
  FAVORITES_DIGEST_METRIC,
  LISTING_SAVED_METRIC,
} from "@/lib/klaviyo/favorites-commerce-event"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-favorites"
const SEED_LISTING_ID = "00000000-0000-4000-8000-000000000001"

const SEED_ITEM = {
  ProductID: SEED_LISTING_ID,
  ProductName: "Seed surfboard (ignore)",
  Quantity: 1,
  ItemPrice: 500,
  RowTotal: 500,
  ProductURL: "https://reswell.app/boards",
  ImageURL: "https://reswell.app/opengraph-image.jpg",
}

const METRICS = [LISTING_SAVED_METRIC, FAVORITES_DIGEST_METRIC, FAVORITE_PRICE_DROP_METRIC] as const

export type BootstrapFavoritesMetricResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapFavoritesMetrics(): Promise<{
  results: BootstrapFavoritesMetricResult[]
}> {
  const time = new Date().toISOString()
  const results: BootstrapFavoritesMetricResult[] = []

  for (const metricName of METRICS) {
    const slug = metricName.toLowerCase().replace(/\s+/g, "-")
    const r = await sendKlaviyoServerEvent({
      metricName,
      profile: {
        external_id: SEED_PROFILE_EXTERNAL_ID,
      },
      uniqueId: `reswell-seed-${slug}`,
      properties: {
        time,
        reswell_metric_seed: true,
        ProductID: SEED_LISTING_ID,
        Items: [SEED_ITEM],
        checkout_items: [
          {
            listing_id: SEED_LISTING_ID,
            ProductID: SEED_LISTING_ID,
            title: SEED_ITEM.ProductName,
            url: SEED_ITEM.ProductURL,
            image_url: SEED_ITEM.ImageURL,
            price: SEED_ITEM.ItemPrice,
            price_display: "$500",
          },
        ],
        item_count: 1,
        listing_ids: SEED_LISTING_ID,
        favorites_url: "https://reswell.app/favorites",
      },
      value: 500,
      valueCurrency: "USD",
    })

    results.push({
      metric_name: metricName,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    })
  }

  return { results }
}

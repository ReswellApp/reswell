import { NextResponse } from "next/server"
import { getDb } from "@/lib/supabase/db"
import {
  buildGoogleShippableSurfboardFeedTsv,
  buildGoogleShippableSurfboardProductInputs,
  isGoogleMerchantCatalogFeedAuthorized,
  resolveGoogleMerchantCatalogFeedFormat,
} from "@/lib/services/googleMerchantShippableSurfboardFeed"

export const maxDuration = 60
export const dynamic = "force-dynamic"

/**
 * Scheduled product feed for a Merchant Center data source that is only
 * surfboards with shipping on. Pickup-only boards and other sections are omitted.
 *
 * Feed URL (production):
 *   https://reswell.app/api/integrations/google-merchant/catalog-feed/shippable-surfboards?token=YOUR_SECRET
 *
 * Register it as its own primary data source with feed label SHIP (not US),
 * so offer ids do not collide with the API primary feed. Defaults to TSV.
 * Append `?format=json` for debugging.
 * When `GOOGLE_MERCHANT_CATALOG_FEED_SECRET` is set, pass it as `?token=` or
 * `Authorization: Bearer`.
 */
export async function GET(request: Request) {
  if (!isGoogleMerchantCatalogFeedAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let supabase
  try {
    supabase = getDb({ consistency: "eventual", purpose: "analytics" })
  } catch {
    return NextResponse.json(
      { error: "Server config: missing service role" },
      { status: 503 },
    )
  }

  try {
    const format = resolveGoogleMerchantCatalogFeedFormat(request)
    const cacheHeaders = {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    }

    if (format === "json") {
      const items = await buildGoogleShippableSurfboardProductInputs(supabase)
      return NextResponse.json(items, { headers: cacheHeaders })
    }

    const tsv = await buildGoogleShippableSurfboardFeedTsv(supabase)
    return new NextResponse(tsv, {
      status: 200,
      headers: {
        ...cacheHeaders,
        "Content-Type": "text/tab-separated-values; charset=utf-8",
        "Content-Disposition": 'inline; filename="reswell-shippable-surfboards.tsv"',
      },
    })
  } catch (e) {
    console.error("[google-merchant] shippable-surfboards feed:", e)
    return NextResponse.json({ error: "Failed to build catalog feed" }, { status: 500 })
  }
}

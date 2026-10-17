import { NextResponse } from "next/server"
import { getDb } from "@/lib/supabase/db"
import {
  buildMetaShippableSurfboardCatalogFeed,
  isMetaCatalogFeedAuthorized,
  metaCatalogFeedToCsv,
  resolveMetaCatalogFeedFormat,
} from "@/lib/services/metaCatalogFeed"

export const maxDuration = 60
export const dynamic = "force-dynamic"

/**
 * Scheduled Meta catalog of surfboards that can be shipped.
 * Pickup-only boards and other sections are excluded.
 *
 * Feed URL (production):
 *   https://reswell.app/api/integrations/meta/catalog-feed/shippable-surfboards?token=YOUR_SECRET
 *
 * Same auth and CSV columns as `/api/integrations/meta/catalog-feed`.
 * Add it as a separate catalog data source in Commerce Manager.
 * Every row has custom_label_2 = Shipping.
 */
export async function GET(request: Request) {
  if (!isMetaCatalogFeedAuthorized(request)) {
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
    const items = await buildMetaShippableSurfboardCatalogFeed(supabase)
    const format = resolveMetaCatalogFeedFormat(request)
    const cacheHeaders = {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    }

    if (format === "json") {
      return NextResponse.json(items, { headers: cacheHeaders })
    }

    return new NextResponse(metaCatalogFeedToCsv(items), {
      status: 200,
      headers: {
        ...cacheHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'inline; filename="reswell-shippable-surfboards.csv"',
      },
    })
  } catch (e) {
    console.error("[meta] catalog-feed/shippable-surfboards:", e)
    return NextResponse.json({ error: "Failed to build catalog feed" }, { status: 500 })
  }
}

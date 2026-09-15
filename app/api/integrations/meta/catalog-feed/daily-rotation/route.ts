import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { buildMetaCatalogDailyRotationFeed } from "@/lib/services/metaCatalogDailyRotationFeed"
import {
  isMetaCatalogFeedAuthorized,
  metaCatalogDailyRotationFeedToCsv,
  resolveMetaCatalogFeedFormat,
} from "@/lib/services/metaCatalogFeed"

export const maxDuration = 60

/**
 * Daily-rotating Meta Commerce catalog (separate catalog from the full feed).
 *
 * 5 fins, 5 traction pads, 5 wetsuits, 5 apparel, 5 magazines, and 5 Hayden
 * Garfield shop surfboards. The set reshuffles every UTC day; reuse is allowed
 * when a bucket has fewer than 10 live listings.
 *
 * Feed URL (production):
 *   https://www.reswell.app/api/integrations/meta/catalog-feed/daily-rotation?token=YOUR_SECRET
 *
 * Same auth as `/api/integrations/meta/catalog-feed`. Defaults to CSV.
 * `custom_label_1` is Fins | Traction | Wetsuits | Apparel | Magazines | HaydenShop.
 * Register this as its own catalog in Commerce Manager — do not replace the
 * primary `/api/integrations/meta/catalog-feed` data source with it.
 */
export async function GET(request: Request) {
  if (!isMetaCatalogFeedAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Server config: missing service role" },
      { status: 503 },
    )
  }

  try {
    const result = await buildMetaCatalogDailyRotationFeed(supabase)
    const format = resolveMetaCatalogFeedFormat(request)
    const cacheHeaders = {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    }

    if (format === "json") {
      return NextResponse.json(result.items, { headers: cacheHeaders })
    }

    return new NextResponse(metaCatalogDailyRotationFeedToCsv(result.items), {
      status: 200,
      headers: {
        ...cacheHeaders,
        "Content-Type": "text/csv; charset=utf-8",
      },
    })
  } catch (e) {
    console.error("[meta] catalog-feed/daily-rotation:", e)
    return NextResponse.json({ error: "Failed to build daily rotation catalog feed" }, { status: 500 })
  }
}

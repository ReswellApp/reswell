import { NextResponse } from "next/server"
import { getDb } from "@/lib/supabase/db"
import {
  buildMetaCatalogGearFeed,
  isMetaCatalogFeedAuthorized,
  metaCatalogFeedToCsv,
  resolveMetaCatalogFeedFormat,
} from "@/lib/services/metaCatalogFeed"

export const maxDuration = 60

/**
 * Gear catalog feed for Meta Commerce Manager.
 * Sections: apparel, traction, boardbags, surfpacks, leashes, fins.
 *
 * Feed URL (production):
 *   https://www.reswell.app/api/integrations/meta/catalog-feed/gear?token=YOUR_SECRET
 *
 * Same auth as `/api/integrations/meta/catalog-feed`. Defaults to CSV.
 * Append `?format=json` for debugging.
 *
 * Register this URL on its own Meta catalog. Apparel, traction, and fins are
 * also in the main feed, and a second data source on that catalog would
 * overwrite their labels.
 *
 * Product `id` matches listing UUID — align Meta Pixel `content_ids` with this value.
 * `custom_label_0` is the section: Apparel | Traction | Boardbags | Surfpacks | Leashes | Fins.
 * `custom_label_1` is SantaBarbara | Ventura when the listing is in those cities.
 * `custom_label_2` is the shop when the seller matches: HaydenGarfield | OutSurfing | Brownstone.
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
    const items = await buildMetaCatalogGearFeed(supabase)
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
      },
    })
  } catch (e) {
    console.error("[meta] catalog-feed/gear:", e)
    return NextResponse.json({ error: "Failed to build gear catalog feed" }, { status: 500 })
  }
}

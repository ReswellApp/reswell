import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { META_CITY_CATALOG_MARKETS } from "@/lib/meta/city-catalog-feed"
import {
  buildMetaCityCatalogFeed,
  isMetaCatalogFeedAuthorized,
  metaCityCatalogFeedToCsv,
  resolveMetaCatalogFeedFormat,
} from "@/lib/services/metaCatalogFeed"

export const maxDuration = 60

/**
 * City catalog feed for Meta Commerce Manager (Santa Barbara + Ventura surfboards).
 *
 * Combined feed (production):
 *   https://www.reswell.app/api/integrations/meta/catalog-feed/cities?token=YOUR_SECRET
 *
 * Single-city feeds:
 *   https://www.reswell.app/api/integrations/meta/catalog-feed/cities/santa-barbara?token=YOUR_SECRET
 *   https://www.reswell.app/api/integrations/meta/catalog-feed/cities/ventura?token=YOUR_SECRET
 *
 * Same auth as `/api/integrations/meta/catalog-feed`. Defaults to CSV.
 * `custom_label_1` is SantaBarbara | Ventura for product-set ads.
 * Product links are listing PDPs (city pages: /reswell/santa-barbara, /reswell/ventura).
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
    const items = await buildMetaCityCatalogFeed(supabase, META_CITY_CATALOG_MARKETS)
    const format = resolveMetaCatalogFeedFormat(request)
    const cacheHeaders = {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    }

    if (format === "json") {
      return NextResponse.json(items, { headers: cacheHeaders })
    }

    return new NextResponse(metaCityCatalogFeedToCsv(items), {
      status: 200,
      headers: {
        ...cacheHeaders,
        "Content-Type": "text/csv; charset=utf-8",
      },
    })
  } catch (e) {
    console.error("[meta] catalog-feed/cities:", e)
    return NextResponse.json({ error: "Failed to build city catalog feed" }, { status: 500 })
  }
}

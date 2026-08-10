import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  buildMetaCatalogFeed,
  isMetaCatalogFeedAuthorized,
  metaCatalogFeedToCsv,
  resolveMetaCatalogFeedFormat,
} from "@/lib/services/metaCatalogFeed"

/**
 * Scheduled product catalog feed for Meta Commerce Manager (Catalog → Data sources → Data feed).
 *
 * Feed URL (production):
 *   https://reswell.app/api/integrations/meta/catalog-feed?token=YOUR_SECRET
 *
 * Defaults to CSV (Meta's standard scheduled feed format). Append `?format=json` for debugging.
 * When `META_CATALOG_FEED_SECRET` is set, pass it as `?token=` or `Authorization: Bearer`.
 *
 * Product `id` matches listing UUID — align Meta Pixel `content_ids` with this value for dynamic ads.
 * Includes active peer listings (`section` surfboards | fins | magazines).
 * Hayden Garfield shop listings get `custom_label_0=HaydenGarfield` for Meta product-set ads.
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
    const items = await buildMetaCatalogFeed(supabase)
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
    console.error("[meta] catalog-feed:", e)
    return NextResponse.json({ error: "Failed to build catalog feed" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { findMetaCityCatalogMarket } from "@/lib/meta/city-catalog-feed"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  buildMetaCityCatalogFeed,
  isMetaCatalogFeedAuthorized,
  metaCityCatalogFeedToCsv,
  resolveMetaCatalogFeedFormat,
} from "@/lib/services/metaCatalogFeed"

export const maxDuration = 60

/**
 * Single-city Meta catalog feed. Slugs: `santa-barbara`, `ventura`
 * (aliases `santa-barbara-ca`, `ventura-ca`).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!isMetaCatalogFeedAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { slug } = await context.params
  const market = findMetaCityCatalogMarket(slug)
  if (!market) {
    return NextResponse.json({ error: "Unknown city catalog" }, { status: 404 })
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
    const items = await buildMetaCityCatalogFeed(supabase, [market])
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
    console.error("[meta] catalog-feed/cities/[slug]:", e)
    return NextResponse.json({ error: "Failed to build city catalog feed" }, { status: 500 })
  }
}

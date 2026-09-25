import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  buildKlaviyoCatalogFeed,
  isKlaviyoCatalogFeedAuthorized,
} from "@/lib/services/klaviyoCatalogFeed"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Public JSON catalog for Klaviyo custom catalog sync (Content → Products → Manage Custom Catalog Sources).
 *
 * Feed URL (production):
 *   https://reswell.app/api/integrations/klaviyo/catalog-feed?token=YOUR_SECRET
 *
 * When `KLAVIYO_CATALOG_FEED_SECRET` is set, pass it as `?token=` or `Authorization: Bearer`.
 * Includes active peer listings (surfboards, fins, magazines, wetsuits, and other marketplace sections).
 * Each row is in stock (`inventory_quantity` 1, `inventory_policy` 2) so Klaviyo marks it published.
 * Response is uncached so Klaviyo's pull reads the current live catalog.
 * Contact Klaviyo support to link metrics (Added to Cart, Checkout Started, Placed Order) with ProductID → catalog $id.
 */
export async function GET(request: Request) {
  if (!isKlaviyoCatalogFeedAuthorized(request)) {
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
    const items = await buildKlaviyoCatalogFeed(supabase)
    return NextResponse.json(items, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    })
  } catch (e) {
    console.error("[klaviyo] catalog-feed:", e)
    return NextResponse.json({ error: "Failed to build catalog feed" }, { status: 500 })
  }
}

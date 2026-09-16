import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { buildMetaCatalogDailyRotationFeed } from "@/lib/services/metaCatalogDailyRotationFeed"

/**
 * Daily rebuild of the Meta daily-rotation catalog.
 * GET /api/cron/meta-catalog-daily-rotation
 *
 * Selection is deterministic per UTC day; this cron warms the set after
 * midnight UTC and logs bucket counts. Protected with CRON_SECRET when set.
 * Scheduled in vercel.json (`5 0 * * *`).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
    return NextResponse.json({
      ok: true,
      seed: result.seed,
      item_count: result.items.length,
      counts: result.counts,
      listing_ids: result.listingIdsByBucket,
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] meta-catalog-daily-rotation failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

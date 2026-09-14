import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { runListingBrandModelBackfill } from "@/lib/services/listingBrandModelBackfill"

export const maxDuration = 120

/**
 * Every 12 hours: scans active surfboard and fin listings missing a directory
 * brand / catalog model. High-confidence title or seller-field matches attach to
 * existing catalog rows. Confirmed-missing brands/models are researched against
 * the official shaper site, created, and attached. Low-confidence cases stay on
 * the unmatched review worklist — nothing is invented. Existing links are never
 * overwritten. Protected with CRON_SECRET.
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
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  try {
    const summary = await runListingBrandModelBackfill(supabase)
    return NextResponse.json({ ok: true, summary, reference_time: new Date().toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] backfill-listing-brand-model failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { runListingBrandModelBackfill } from "@/lib/services/listingBrandModelBackfill"

export const maxDuration = 60

/**
 * Daily: scans active surfboard listings missing a directory brand / catalog model
 * and attaches confident matches found in the listing title (whole-word match against
 * the brand catalog, then that brand's models). Existing links are never overwritten.
 * Protected with CRON_SECRET (same pattern as other cron routes).
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

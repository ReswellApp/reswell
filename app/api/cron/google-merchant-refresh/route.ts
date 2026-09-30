import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { isGoogleMerchantConfigured } from "@/lib/google-merchant/config"
import { refreshExpiringGoogleMerchantListings } from "@/lib/services/googleMerchantSync"

export const maxDuration = 300

/**
 * Hourly Google Ads / Merchant Center refresh.
 * GET /api/cron/google-merchant-refresh
 *
 * Shopping products expire 30 days after the last successful publish. This job
 * resubmits active listings at the 29-day mark (and listings with no publish
 * row), then removes products for listings that are no longer eligible.
 *
 * Protected with CRON_SECRET when set. Scheduled in vercel.json (`20 * * * *`).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isGoogleMerchantConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "google_merchant_not_configured" })
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  try {
    const summary = await refreshExpiringGoogleMerchantListings(supabase)
    return NextResponse.json({
      ok: true,
      summary,
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] google-merchant-refresh failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

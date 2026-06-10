import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { isGoogleMerchantConfigured } from "@/lib/google-merchant/config"
import { syncAllActiveListingsToGoogleMerchant } from "@/lib/services/googleMerchantSync"

/**
 * Hourly refresh + reconciliation for Google Merchant product feed.
 * GET /api/cron/google-merchant-refresh
 *
 * Protected with CRON_SECRET when set. Scheduled in vercel.json (`0 * * * *`).
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
    const summary = await syncAllActiveListingsToGoogleMerchant(supabase)
    return NextResponse.json({
      ok: true,
      summary,
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

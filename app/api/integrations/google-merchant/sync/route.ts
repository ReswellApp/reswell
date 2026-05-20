import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { authorizeGoogleMerchantAdmin } from "@/lib/google-merchant/authorize"
import { isGoogleMerchantConfigured } from "@/lib/google-merchant/config"
import { syncAllActiveListingsToGoogleMerchant } from "@/lib/services/googleMerchantSync"

/**
 * Bulk sync active surfboard listings to Google Merchant Center.
 * POST /api/integrations/google-merchant/sync
 *
 * Auth: admin session or Bearer SEARCH_REINDEX_SECRET / GOOGLE_MERCHANT_SETUP_SECRET / CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const authorized =
    (await authorizeGoogleMerchantAdmin(request, "SEARCH_REINDEX_SECRET")) ||
    (await authorizeGoogleMerchantAdmin(request, "GOOGLE_MERCHANT_SETUP_SECRET")) ||
    (await authorizeGoogleMerchantAdmin(request, "CRON_SECRET"))

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isGoogleMerchantConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google Merchant API is not configured. Set GOOGLE_MERCHANT_ACCOUNT_ID, GOOGLE_MERCHANT_DATA_SOURCE_NAME, and GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON.",
      },
      { status: 503 },
    )
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 503 })
  }

  const supabase = createServiceRoleClient()

  try {
    const summary = await syncAllActiveListingsToGoogleMerchant(supabase)
    return NextResponse.json({ ok: true, summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

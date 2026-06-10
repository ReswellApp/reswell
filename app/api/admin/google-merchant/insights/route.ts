import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { buildGoogleMerchantInsights } from "@/lib/services/googleMerchantInsights"

export const dynamic = "force-dynamic"

const ALLOWED_RANGE_DAYS = new Set([7, 28, 90])

/**
 * Google Merchant Center + GA4 intelligence for the admin dashboard.
 * GET /api/admin/google-merchant/insights?days=28
 *
 * Admin-only. Always returns 200 with a `configured: false` payload when the Merchant API is not
 * connected, so the client can render setup guidance instead of an error.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const daysParam = Number.parseInt(request.nextUrl.searchParams.get("days") ?? "", 10)
  const days = ALLOWED_RANGE_DAYS.has(daysParam) ? daysParam : 28

  try {
    let supabase = gate.ctx.supabase
    try {
      supabase = createServiceRoleClient()
    } catch {
      // Local dev without service role — fall back to admin session client.
    }

    const insights = await buildGoogleMerchantInsights(supabase, { days })
    return NextResponse.json({ data: insights }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[admin/google-merchant/insights]", message)
    return NextResponse.json({ error: "Could not load Merchant Center insights" }, { status: 500 })
  }
}

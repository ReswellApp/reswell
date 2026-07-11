import { createServiceRoleClient } from "@/lib/supabase/server"
import { processNewsletterPromoExpirationNudge } from "@/lib/services/newsletterPromoExpirationNudge"
import { NextResponse } from "next/server"

/**
 * Daily job: unredeemed newsletter promos expiring in ~3 days → bump to 15% off (same code) +
 * Klaviyo **Newsletter Promo Expiring** email with the promo code.
 *
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

  const referenceTime = new Date()

  try {
    const summary = await processNewsletterPromoExpirationNudge(supabase, referenceTime)

    return NextResponse.json({
      ...summary,
      reference_time: referenceTime.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

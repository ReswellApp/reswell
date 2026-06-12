import "@/lib/klaviyo/bootstrap-env"
import { BUYER_REVIEW_ELIGIBLE_METRIC_NAME } from "@/lib/klaviyo/track-buyer-review-eligible"
import { notifyBuyerReviewEligibleKlaviyo } from "@/lib/services/notifyBuyerReviewEligibleKlaviyo"
import { klaviyoTriggerBuyerReviewEligibleBodySchema } from "@/lib/validations/klaviyoTriggerBuyerReviewEligible"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * Manually emit **Buyer Review Eligible** for one order (Klaviyo Events API).
 * Protect with `CRON_SECRET` when set (`Authorization: Bearer …`), same pattern as other cron routes.
 *
 * Testing: send `"dedupe_nonce": "manual-1730000000"` so Klaviyo does not dedupe repeat requests.
 * Use `"force": true` to bypass delivery/review eligibility when testing templates.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = klaviyoTriggerBuyerReviewEligibleBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  const { order_id, trigger, force, dedupe_nonce } = parsed.data

  const result = await notifyBuyerReviewEligibleKlaviyo(supabase, order_id, trigger, {
    dedupeNonce: dedupe_nonce,
    force,
  })

  return NextResponse.json({
    metric_name: BUYER_REVIEW_ELIGIBLE_METRIC_NAME,
    order_id,
    sent: result.sent,
    reason: result.reason ?? null,
    klaviyo: result.klaviyo
      ? {
          ok: result.klaviyo.ok,
          skipped: result.klaviyo.skipped,
          status: result.klaviyo.status,
          skip_reason: result.klaviyo.skipReason ?? null,
          detail: result.klaviyo.detail,
        }
      : null,
  })
}

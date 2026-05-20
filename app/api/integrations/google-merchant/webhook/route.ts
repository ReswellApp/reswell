import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { isGoogleMerchantConfigured } from "@/lib/google-merchant/config"
import { syncListingToGoogleMerchant } from "@/lib/services/googleMerchantSync"

type WebhookRecord = { id?: string }

type WebhookBody = {
  type?: string
  table?: string
  record?: WebhookRecord
  old_record?: WebhookRecord
}

/**
 * Supabase Database Webhook: sync listing changes to Google Merchant Center.
 * POST /api/integrations/google-merchant/webhook
 *
 * Header: Authorization: Bearer <GOOGLE_MERCHANT_WEBHOOK_SECRET>
 * (or reuse SUPABASE_ES_WEBHOOK_SECRET if GOOGLE_MERCHANT_WEBHOOK_SECRET is unset)
 */
export async function POST(request: NextRequest) {
  const secret =
    process.env.GOOGLE_MERCHANT_WEBHOOK_SECRET?.trim() ||
    process.env.SUPABASE_ES_WEBHOOK_SECRET?.trim()

  if (!secret) {
    return NextResponse.json(
      { error: "GOOGLE_MERCHANT_WEBHOOK_SECRET is not configured" },
      { status: 503 },
    )
  }

  const authOk =
    request.headers.get("authorization") === `Bearer ${secret}` ||
    request.headers.get("x-google-merchant-webhook-secret") === secret

  if (!authOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isGoogleMerchantConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "google_merchant_not_configured" })
  }

  let body: WebhookBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body.table !== "listings") {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const listingId = body.record?.id ?? body.old_record?.id
  if (!listingId) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  try {
    const result = await syncListingToGoogleMerchant(supabase, listingId)
    if (result.action === "error") {
      return NextResponse.json({ error: result.error, offerId: result.offerId }, { status: 502 })
    }
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : "sync failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

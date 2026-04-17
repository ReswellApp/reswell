import { NextResponse } from "next/server"
import { applyShipEngineTrackWebhook } from "@/lib/services/applyShipEngineTrackWebhook"
import {
  ShipEngineMissingWebhookHeadersError,
  ShipEngineWebhookSignatureError,
  ShipEngineWebhookTimestampError,
  verifyShipEngineWebhookSignature,
} from "@/lib/shipengine/webhook-signature"
import { shipEngineTrackWebhookSchema } from "@/lib/validations/shipengine-track-webhook"

export const runtime = "nodejs"

/**
 * ShipStation API (ShipEngine) → track webhook.
 * Dashboard: Developer → Webhooks → event `track` → URL `https://<domain>/api/webhooks/shipengine`
 * Verify signatures with JWKS (no shared secret in env).
 */
export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error("[shipengine webhook] SUPABASE_SERVICE_ROLE_KEY is not set")
    return NextResponse.json({ error: "Webhook handler not configured" }, { status: 501 })
  }

  const rawBody = await request.text()

  try {
    await verifyShipEngineWebhookSignature(request.headers, rawBody)
  } catch (e) {
    if (e instanceof ShipEngineMissingWebhookHeadersError) {
      return new NextResponse(null, { status: 404 })
    }
    if (e instanceof ShipEngineWebhookTimestampError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    if (e instanceof ShipEngineWebhookSignatureError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
    console.error("[shipengine webhook] verify:", e)
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody) as unknown
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const rec = json && typeof json === "object" ? (json as { resource_type?: string }) : null
  if (rec?.resource_type !== "API_TRACK") {
    return NextResponse.json({ received: true, skipped: true })
  }

  const parsed = shipEngineTrackWebhookSchema.safeParse(json)
  if (!parsed.success) {
    console.warn("[shipengine webhook] payload validation:", parsed.error.flatten())
    return NextResponse.json({ error: "Invalid track payload" }, { status: 400 })
  }

  const result = await applyShipEngineTrackWebhook(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ received: true, matched: result.matched })
}

export function GET() {
  return new NextResponse(null, { status: 404 })
}

import { NextRequest, NextResponse } from "next/server"
import { isShopifyConfigured } from "@/lib/shopify/config"
import { verifyShopifyWebhookHmacWithSecrets } from "@/lib/shopify/crypto"
import { ingestShopifyManualWebhook } from "@/lib/services/shopifyWebhook"
import { shopifyWebhookHeadersSchema } from "@/lib/validations/shopify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ key: string }> },
) {
  if (!isShopifyConfigured()) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  const { key } = await context.params
  const routeKey = key?.trim()
  if (!routeKey) {
    return NextResponse.json({ error: "Invalid webhook route" }, { status: 400 })
  }

  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody, "utf8") > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  const headers = shopifyWebhookHeadersSchema.safeParse({
    shopDomain: request.headers.get("x-shopify-shop-domain"),
    topic: request.headers.get("x-shopify-topic"),
    webhookId: request.headers.get("x-shopify-webhook-id"),
  })
  if (!headers.success) {
    return NextResponse.json({ error: "Invalid webhook headers" }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody) as unknown
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  try {
    const secrets = await ingestShopifyManualWebhook({
      routeKey,
      ...headers.data,
      payload: payload as Record<string, unknown>,
      suppliedHmac: request.headers.get("x-shopify-hmac-sha256"),
      rawBody,
    })
    if (!secrets.ok) {
      return NextResponse.json({ error: secrets.error }, { status: secrets.status })
    }
    return NextResponse.json({
      received: true,
      duplicate: secrets.duplicate === "duplicate",
    })
  } catch (error) {
    console.error("[shopify] manual webhook ingest", error)
    return NextResponse.json({ error: "Webhook ingest failed" }, { status: 503 })
  }
}

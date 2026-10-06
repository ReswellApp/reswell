import { NextRequest, NextResponse } from "next/server"
import { isShopifyConfigured } from "@/lib/shopify/config"
import { verifyShopifyWebhookHmac } from "@/lib/shopify/crypto"
import { ingestShopifyWebhook } from "@/lib/services/shopifyWebhook"
import { shopifyWebhookHeadersSchema } from "@/lib/validations/shopify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (!isShopifyConfigured()) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }
  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody, "utf8") > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }
  if (
    !verifyShopifyWebhookHmac(
      rawBody,
      request.headers.get("x-shopify-hmac-sha256"),
    )
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
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
    const result = await ingestShopifyWebhook({
      ...headers.data,
      payload: payload as Record<string, unknown>,
    })
    return NextResponse.json({ received: true, duplicate: result === "duplicate" })
  } catch (error) {
    console.error("[shopify] webhook ingest", error)
    return NextResponse.json({ error: "Webhook ingest failed" }, { status: 503 })
  }
}

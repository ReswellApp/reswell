import { createHmac, timingSafeEqual } from "crypto"
import { shopifyApiSecret } from "@/lib/shopify/config"

export function signShopifyOAuthState(payload: { userId: string; shop: string; nonce: string }): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = createHmac("sha256", shopifyApiSecret()).update(body).digest("base64url")
  return `${body}.${sig}`
}

export function verifyShopifyOAuthState(
  state: string,
): { userId: string; shop: string; nonce: string } | null {
  const [body, sig] = state.split(".")
  if (!body || !sig) return null

  const expected = createHmac("sha256", shopifyApiSecret()).update(body).digest("base64url")
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      userId?: string
      shop?: string
      nonce?: string
    }
    if (!parsed.userId || !parsed.shop || !parsed.nonce) return null
    return { userId: parsed.userId, shop: parsed.shop, nonce: parsed.nonce }
  } catch {
    return null
  }
}

export function verifyShopifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader?.trim()) return false
  const digest = createHmac("sha256", shopifyApiSecret()).update(rawBody, "utf8").digest("base64")
  const a = Buffer.from(digest)
  const b = Buffer.from(hmacHeader.trim())
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

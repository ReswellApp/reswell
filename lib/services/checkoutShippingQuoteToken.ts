import { createHmac, timingSafeEqual } from "node:crypto"

/** How long a shipping-quote token remains valid for payment-intent creation. */
export const CHECKOUT_SHIPPING_QUOTE_TOKEN_TTL_MS = 15 * 60 * 1000

export type CheckoutShippingQuoteTokenPayload = {
  buyerId: string
  listingIds: string[]
  addressId: string
  itemSubtotalCents: number
  shippingCents: number
  totalCents: number
  usedReswellQuote: boolean
  exp: number
}

function signingSecret(): string | null {
  const dedicated = process.env.CHECKOUT_QUOTE_SIGNING_SECRET?.trim()
  if (dedicated) return dedicated
  return process.env.STRIPE_SECRET_KEY?.trim() || null
}

function encodePayload(payload: CheckoutShippingQuoteTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

function decodePayload(encoded: string): CheckoutShippingQuoteTokenPayload | null {
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8")
    const parsed = JSON.parse(raw) as CheckoutShippingQuoteTokenPayload
    if (
      typeof parsed.buyerId !== "string" ||
      !Array.isArray(parsed.listingIds) ||
      typeof parsed.addressId !== "string" ||
      typeof parsed.itemSubtotalCents !== "number" ||
      typeof parsed.shippingCents !== "number" ||
      typeof parsed.totalCents !== "number" ||
      typeof parsed.usedReswellQuote !== "boolean" ||
      typeof parsed.exp !== "number"
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function signBody(encoded: string, secret: string): string {
  return createHmac("sha256", secret).update(encoded, "utf8").digest("base64url")
}

function sortedListingIds(ids: string[]): string[] {
  return [...ids].map((id) => id.trim()).filter(Boolean).sort()
}

export function signCheckoutShippingQuoteToken(input: {
  buyerId: string
  listingIds: string[]
  addressId: string
  itemSubtotalUsd: number
  shippingUsd: number
  totalUsd: number
  usedReswellQuote: boolean
}): string | null {
  const secret = signingSecret()
  if (!secret) return null

  const payload: CheckoutShippingQuoteTokenPayload = {
    buyerId: input.buyerId.trim(),
    listingIds: sortedListingIds(input.listingIds),
    addressId: input.addressId.trim(),
    itemSubtotalCents: Math.round(input.itemSubtotalUsd * 100),
    shippingCents: Math.round(input.shippingUsd * 100),
    totalCents: Math.round(input.totalUsd * 100),
    usedReswellQuote: input.usedReswellQuote,
    exp: Date.now() + CHECKOUT_SHIPPING_QUOTE_TOKEN_TTL_MS,
  }

  const encoded = encodePayload(payload)
  return `${encoded}.${signBody(encoded, secret)}`
}

export function verifyCheckoutShippingQuoteToken(
  token: string,
  expected: {
    buyerId: string
    listingIds: string[]
    addressId: string
  },
): { ok: true; payload: CheckoutShippingQuoteTokenPayload } | { ok: false; error: string } {
  const secret = signingSecret()
  if (!secret) {
    return { ok: false, error: "Shipping quote verification is not configured." }
  }

  const trimmed = token.trim()
  const dot = trimmed.lastIndexOf(".")
  if (dot <= 0) {
    return { ok: false, error: "Invalid shipping quote token." }
  }

  const encoded = trimmed.slice(0, dot)
  const sig = trimmed.slice(dot + 1)
  const expectedSig = signBody(encoded, secret)

  const sigBuf = Buffer.from(sig, "utf8")
  const expectedBuf = Buffer.from(expectedSig, "utf8")
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, error: "Invalid shipping quote token." }
  }

  const payload = decodePayload(encoded)
  if (!payload) {
    return { ok: false, error: "Invalid shipping quote token." }
  }

  if (payload.exp < Date.now()) {
    return { ok: false, error: "Shipping quote expired — refresh your shipping total." }
  }

  const buyerId = expected.buyerId.trim()
  const addressId = expected.addressId.trim()
  const listingIds = sortedListingIds(expected.listingIds)

  if (payload.buyerId !== buyerId) {
    return { ok: false, error: "Shipping quote does not match your session." }
  }
  if (payload.addressId !== addressId) {
    return { ok: false, error: "Shipping quote does not match this address." }
  }
  if (payload.listingIds.join(",") !== listingIds.join(",")) {
    return { ok: false, error: "Shipping quote does not match these items." }
  }

  return { ok: true, payload }
}

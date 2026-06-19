import { createHmac, timingSafeEqual } from "node:crypto"

/** Receipts stay valid for a year so a customer can re-open the link long after the sale. */
export const POS_RECEIPT_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000

type ReceiptPayload = {
  orderId: string
  exp: number
}

function signingSecret(): string | null {
  const dedicated = process.env.CHECKOUT_QUOTE_SIGNING_SECRET?.trim()
  if (dedicated) return dedicated
  return process.env.STRIPE_SECRET_KEY?.trim() || null
}

function encodePayload(payload: ReceiptPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

function decodePayload(encoded: string): ReceiptPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ReceiptPayload
    if (typeof parsed.orderId !== "string" || typeof parsed.exp !== "number") return null
    return parsed
  } catch {
    return null
  }
}

function signBody(encoded: string, secret: string): string {
  return createHmac("sha256", secret).update(encoded, "utf8").digest("base64url")
}

export function signPosReceiptToken(orderId: string): string | null {
  const secret = signingSecret()
  if (!secret) return null
  const encoded = encodePayload({ orderId, exp: Date.now() + POS_RECEIPT_TOKEN_TTL_MS })
  return `${encoded}.${signBody(encoded, secret)}`
}

export function verifyPosReceiptToken(
  token: string,
): { ok: true; orderId: string } | { ok: false; error: string } {
  const secret = signingSecret()
  if (!secret) return { ok: false, error: "Receipts are not configured." }

  const [encoded, sig] = token.split(".")
  if (!encoded || !sig) return { ok: false, error: "Invalid receipt link." }

  const expected = signBody(encoded, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "Invalid receipt link." }
  }

  const payload = decodePayload(encoded)
  if (!payload) return { ok: false, error: "Invalid receipt link." }
  if (Date.now() > payload.exp) return { ok: false, error: "This receipt link has expired." }

  return { ok: true, orderId: payload.orderId }
}

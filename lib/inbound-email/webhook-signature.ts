import { createHmac, timingSafeEqual } from "node:crypto"

export class InboundEmailMissingAuthError extends Error {
  readonly name = "InboundEmailMissingAuthError"
  constructor(message = "Missing webhook authentication") {
    super(message)
  }
}

export class InboundEmailSignatureError extends Error {
  readonly name = "InboundEmailSignatureError"
  constructor(message = "Invalid webhook signature") {
    super(message)
  }
}

export class InboundEmailTimestampError extends Error {
  readonly name = "InboundEmailTimestampError"
  constructor(message = "Webhook timestamp outside allowed window") {
    super(message)
  }
}

const MAX_AGE_SECONDS = 5 * 60

export function inboundEmailWebhookSecret(): string {
  return (
    process.env.SUPPORT_INBOUND_EMAIL_WEBHOOK_SECRET?.trim() ||
    process.env.RESEND_WEBHOOK_SECRET?.trim() ||
    ""
  )
}

function secretKey(secret: string): Buffer {
  const raw = secret.trim()
  if (raw.startsWith("whsec_")) {
    return Buffer.from(raw.slice("whsec_".length), "base64")
  }
  return Buffer.from(raw, "utf8")
}

function hmacEqual(key: Buffer, content: string, givenB64: string): boolean {
  const expected = createHmac("sha256", key).update(content, "utf8").digest("base64")
  const a = Buffer.from(expected)
  const b = Buffer.from(givenB64)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function timingSafeStringEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function signaturesFromHeader(header: string): string[] {
  return header
    .split(/\s+/)
    .map((part) => {
      const comma = part.indexOf(",")
      if (comma === -1) return ""
      const version = part.slice(0, comma)
      if (version !== "v1") return ""
      return part.slice(comma + 1)
    })
    .filter(Boolean)
}

/**
 * Resend / Svix Standard Webhooks (`svix-*`) or a shared Bearer secret.
 * @see https://resend.com/docs/webhooks/verify-webhooks-requests
 */
export function verifyInboundEmailWebhookAuth(args: {
  rawBody: string
  headers: Headers
  secret: string
}): void {
  const secret = args.secret.trim()
  if (!secret) throw new InboundEmailMissingAuthError("Webhook secret is not configured")

  const svixId = args.headers.get("svix-id") ?? args.headers.get("webhook-id")
  const svixTs = args.headers.get("svix-timestamp") ?? args.headers.get("webhook-timestamp")
  const svixSig = args.headers.get("svix-signature") ?? args.headers.get("webhook-signature")

  if (svixId?.trim() && svixTs?.trim() && svixSig?.trim()) {
    const ts = Number(svixTs)
    if (!Number.isFinite(ts)) {
      throw new InboundEmailTimestampError("Invalid webhook timestamp")
    }
    const age = Math.abs(Date.now() / 1000 - ts)
    if (age > MAX_AGE_SECONDS) {
      throw new InboundEmailTimestampError()
    }
    const signed = `${svixId}.${svixTs}.${args.rawBody}`
    const key = secretKey(secret)
    const matched = signaturesFromHeader(svixSig).some((sig) => hmacEqual(key, signed, sig))
    if (!matched) throw new InboundEmailSignatureError()
    return
  }

  const authorization = args.headers.get("authorization") ?? ""
  const headerSecret = args.headers.get("x-inbound-email-webhook-secret")?.trim() ?? ""
  const token = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : headerSecret

  if (!token) throw new InboundEmailMissingAuthError()
  if (!timingSafeStringEqual(token, secret)) throw new InboundEmailSignatureError()
}

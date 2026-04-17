import { createPublicKey, createVerify } from "node:crypto"
import { getShipEngineJwksUrl } from "@/lib/shipengine/config"

type JwkRsa = {
  kid?: string
  kty: string
  n: string
  e: string
}

type JwksBody = { keys: JwkRsa[] }

export class ShipEngineMissingWebhookHeadersError extends Error {
  readonly name = "ShipEngineMissingWebhookHeadersError"
}

export class ShipEngineWebhookTimestampError extends Error {
  readonly name = "ShipEngineWebhookTimestampError"
}

export class ShipEngineWebhookSignatureError extends Error {
  readonly name = "ShipEngineWebhookSignatureError"
}

let jwksCache: JwksBody | null = null
let jwksEtag: string | null = null

async function fetchJwks(forceRefresh: boolean): Promise<JwksBody> {
  const url = getShipEngineJwksUrl()
  const headers: Record<string, string> = {}
  if (!forceRefresh && jwksEtag) {
    headers["If-None-Match"] = jwksEtag
  }
  const res = await fetch(url, { method: "GET", headers })
  if (res.status === 304 && jwksCache) {
    return jwksCache
  }
  if (!res.ok) {
    throw new Error(`JWKS fetch failed: ${res.status}`)
  }
  const body = (await res.json()) as JwksBody
  jwksCache = body
  jwksEtag = res.headers.get("etag")
  return body
}

function publicKeyForKid(kid: string, jwks: JwksBody): ReturnType<typeof createPublicKey> | null {
  const jwk = jwks.keys.find((k) => k.kid === kid && k.kty === "RSA" && k.n && k.e)
  if (!jwk) return null
  return createPublicKey({
    key: { kty: "RSA", n: jwk.n, e: jwk.e },
    format: "jwk",
  })
}

/**
 * Verifies ShipStation API / ShipEngine webhook RSA-SHA256 signature.
 * @see https://www.shipengine.com/docs/webhooks/
 */
export async function verifyShipEngineWebhookSignature(
  headers: Headers,
  rawBody: string,
): Promise<void> {
  const keyId = headers.get("x-shipengine-rsa-sha256-key-id")
  const signatureB64 = headers.get("x-shipengine-rsa-sha256-signature")
  const timestamp = headers.get("x-shipengine-timestamp")
  if (!keyId?.trim() || !signatureB64?.trim() || !timestamp?.trim()) {
    throw new ShipEngineMissingWebhookHeadersError()
  }

  const webhookTime = new Date(timestamp.trim())
  if (Number.isNaN(webhookTime.getTime())) {
    throw new ShipEngineWebhookTimestampError("Invalid x-shipengine-timestamp")
  }
  const ageMinutes = Math.abs(Date.now() - webhookTime.getTime()) / 1000 / 60
  if (ageMinutes > 5) {
    throw new ShipEngineWebhookTimestampError("Webhook timestamp outside allowed window")
  }

  let jwks = await fetchJwks(false)
  let key = publicKeyForKid(keyId.trim(), jwks)
  if (!key) {
    jwks = await fetchJwks(true)
    key = publicKeyForKid(keyId.trim(), jwks)
  }
  if (!key) {
    throw new ShipEngineWebhookSignatureError(`No JWKS key for kid ${keyId}`)
  }

  const signedPayload = `${timestamp.trim()}.${rawBody}`
  const verify = createVerify("RSA-SHA256")
  verify.update(signedPayload, "utf8")
  verify.end()
  const ok = verify.verify(key, signatureB64.trim(), "base64")
  if (!ok) {
    throw new ShipEngineWebhookSignatureError("Signature verification failed")
  }
}

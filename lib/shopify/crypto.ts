import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"
import {
  shopifyApiSecret,
  shopifyTokenEncryptionKeyVersion,
} from "@/lib/shopify/config"

export interface EncryptedShopifySecret {
  ciphertext: string
  iv: string
  tag: string
  keyVersion: number
}

function decodeEncryptionKey(raw: string): Buffer {
  const hex = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : null
  const key = hex ?? Buffer.from(raw, "base64")
  if (key.byteLength !== 32) {
    throw new Error("Shopify token encryption keys must decode to 32 bytes")
  }
  return key
}

function encryptionKey(version: number): Buffer {
  if (version === shopifyTokenEncryptionKeyVersion()) {
    const current = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY?.trim()
    if (!current) throw new Error("SHOPIFY_TOKEN_ENCRYPTION_KEY is not configured")
    return decodeEncryptionKey(current)
  }
  const keyringRaw = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEYRING?.trim()
  if (keyringRaw) {
    try {
      const keyring = JSON.parse(keyringRaw) as Record<string, unknown>
      const prior = keyring[String(version)]
      if (typeof prior === "string" && prior.trim()) {
        return decodeEncryptionKey(prior.trim())
      }
    } catch {
      throw new Error("SHOPIFY_TOKEN_ENCRYPTION_KEYRING is invalid JSON")
    }
  }
  throw new Error(`No Shopify credential key is configured for version ${version}`)
}

export function encryptShopifySecret(plaintext: string): EncryptedShopifySecret {
  const iv = randomBytes(12)
  const keyVersion = shopifyTokenEncryptionKeyVersion()
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(keyVersion), iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    keyVersion,
  }
}

export function decryptShopifySecret(input: {
  ciphertext: string
  iv: string
  tag: string
  keyVersion: number
}): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(input.keyVersion),
    Buffer.from(input.iv, "base64"),
  )
  decipher.setAuthTag(Buffer.from(input.tag, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

export function createShopifyOAuthState(): {
  state: string
  stateHash: string
} {
  const state = randomBytes(32).toString("base64url")
  return { state, stateHash: hashShopifyOAuthState(state) }
}

export function hashShopifyOAuthState(state: string): string {
  return createHash("sha256").update(state, "utf8").digest("hex")
}

function secureEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function verifyShopifyOAuthHmac(searchParams: URLSearchParams): boolean {
  const supplied = searchParams.get("hmac")?.trim()
  if (!supplied) return false

  const message = [...searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
  const expected = createHmac("sha256", shopifyApiSecret())
    .update(message, "utf8")
    .digest("hex")
  return secureEqual(expected, supplied)
}

export function verifyShopifyWebhookHmac(
  rawBody: string,
  suppliedHmac: string | null,
): boolean {
  if (!suppliedHmac?.trim()) return false
  const expected = createHmac("sha256", shopifyApiSecret())
    .update(rawBody, "utf8")
    .digest("base64")
  return secureEqual(expected, suppliedHmac.trim())
}

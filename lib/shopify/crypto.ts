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

function encryptionKey(): Buffer {
  const raw = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY?.trim()
  if (!raw) throw new Error("SHOPIFY_TOKEN_ENCRYPTION_KEY is not configured")

  const hex = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : null
  const key = hex ?? Buffer.from(raw, "base64")
  if (key.byteLength !== 32) {
    throw new Error("SHOPIFY_TOKEN_ENCRYPTION_KEY must decode to 32 bytes")
  }
  return key
}

export function encryptShopifySecret(plaintext: string): EncryptedShopifySecret {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    keyVersion: shopifyTokenEncryptionKeyVersion(),
  }
}

export function decryptShopifySecret(input: {
  ciphertext: string
  iv: string
  tag: string
  keyVersion: number
}): string {
  if (input.keyVersion !== shopifyTokenEncryptionKeyVersion()) {
    throw new Error("Shopify credential uses an unsupported encryption key version")
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
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

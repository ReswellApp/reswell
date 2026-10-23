import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export function mcpRandomToken(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`
}

export function mcpHashSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

export function mcpSafeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8")
  const right = Buffer.from(b, "utf8")
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/** RFC 7636 S256: BASE64URL(SHA256(verifier)) */
export function mcpPkceChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

import { randomBytes } from "node:crypto"

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** Human-friendly unique code, e.g. `ADMIN-K7M3NP`. */
export function generateAdminIssuedPromoCode(): string {
  const bytes = randomBytes(6)
  let suffix = ""
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]
  }
  return `ADMIN-${suffix}`
}

export function isAdminIssuedPromoCodePrefix(code: string): boolean {
  return code.startsWith("ADMIN-")
}

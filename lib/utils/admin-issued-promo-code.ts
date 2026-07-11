import { randomBytes } from "node:crypto"

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** Human-friendly unique code, e.g. `K7M3NP8X` (no prefix). */
export function generateAdminIssuedPromoCode(): string {
  const bytes = randomBytes(8)
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]
  }
  return code
}

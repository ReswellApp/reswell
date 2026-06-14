import { randomBytes } from "node:crypto"

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** Human-friendly unique code, e.g. `WELCOME-K7M3NP`. */
export function generateNewsletterPromoCode(): string {
  const bytes = randomBytes(6)
  let suffix = ""
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]
  }
  return `WELCOME-${suffix}`
}

export function normalizeNewsletterPromoCodeInput(raw: string): string {
  return raw.trim().toUpperCase()
}

export function normalizeNewsletterPromoEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

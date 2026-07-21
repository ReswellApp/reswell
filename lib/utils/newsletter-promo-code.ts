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

/**
 * Normalize user-entered promo codes for lookup.
 * Trims, uppercases, strips spaces/underscores, and repairs `WELCOME` + 6-char suffix
 * when the hyphen was omitted (e.g. `WELCOME K7M3NP` → `WELCOME-K7M3NP`).
 */
export function normalizeNewsletterPromoCodeInput(raw: string): string {
  const compact = raw.trim().toUpperCase().replace(/[\s_]+/g, "")
  const welcomeMatch = compact.match(/^WELCOME-?([A-Z0-9]{6})$/)
  if (welcomeMatch) {
    return `WELCOME-${welcomeMatch[1]}`
  }
  return compact
}

export function normalizeNewsletterPromoEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

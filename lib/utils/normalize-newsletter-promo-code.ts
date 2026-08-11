/**
 * Normalize user-entered promo codes for lookup.
 * Safe for client and server — no Node built-ins.
 *
 * Trims, uppercases, strips spaces/underscores/invisible paste artifacts, maps unicode
 * dashes to ASCII `-`, and repairs `WELCOME` + 6-char suffix when the hyphen was omitted
 * (e.g. `WELCOME K7M3NP` → `WELCOME-K7M3NP`).
 *
 * Email clients often paste en/em dashes or zero-width chars that otherwise fail DB lookup
 * with "That promo code is not valid."
 */
export function normalizeNewsletterPromoCodeInput(raw: string): string {
  const compact = raw
    .trim()
    .toUpperCase()
    // BOM + zero-width / soft hyphen / bidi paste junk from mail clients
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
    // en/em dash, non-breaking hyphen, figure dash, minus sign → ASCII hyphen
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\s_]+/g, "")
  const welcomeMatch = compact.match(/^WELCOME-?([A-Z0-9]{6})$/)
  if (welcomeMatch) {
    return `WELCOME-${welcomeMatch[1]}`
  }
  return compact
}

export function normalizeNewsletterPromoEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Marketplace policy: prohibit off-platform payment terms in DM text.
 */

const OFF_PLATFORM_PAYMENT_SERVICES_PATTERN = /\b(?:venmo|paypal|pay\s*pal)\b/i

export function messageContainsOffPlatformPaymentTerms(text: string): boolean {
  const t = text.trim()
  if (!t) return false

  if (OFF_PLATFORM_PAYMENT_SERVICES_PATTERN.test(t)) return true
  if (/\bcash\b/i.test(t)) return true

  return false
}

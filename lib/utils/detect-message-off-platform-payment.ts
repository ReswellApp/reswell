/**
 * Marketplace policy: prohibit off-platform payment terms in DM text.
 * Named apps are high-precision. Isolated “cash” is ambiguous (pickup vs request)
 * and is reviewed by the fraud LLM. Common innocent cash phrasing is ignored.
 */

const NAMED_OFF_PLATFORM_PAYMENT_SERVICES_PATTERN =
  /\b(?:venmo|paypal|pay\s*pal|zelle|cash\s*app|cashapp|apple\s*cash|western\s*union|money\s*gram|moneygram|wire\s*transfer)\b/i

/** “Cash pickup Saturday” / “pay in cash locally” — not an off-platform request. */
const INNOCENT_CASH_PATTERN =
  /\b(?:cash\s+(?:pick\s*up|pickup|only)|pay(?:ment)?\s+(?:in\s+|with\s+)?cash|in\s+cash|cash\s+on\s+(?:pick\s*up|pickup|delivery)|local\s+cash)\b/i

export function messageContainsNamedOffPlatformPaymentService(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return NAMED_OFF_PLATFORM_PAYMENT_SERVICES_PATTERN.test(t)
}

export function messageContainsAmbiguousCashTerm(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (!/\bcash\b/i.test(t)) return false
  if (messageContainsNamedOffPlatformPaymentService(t)) return false
  if (INNOCENT_CASH_PATTERN.test(t)) return false
  return true
}

export function messageContainsOffPlatformPaymentTerms(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return messageContainsNamedOffPlatformPaymentService(t) || messageContainsAmbiguousCashTerm(t)
}

/**
 * Meta Pixel / Conversions API currency codes.
 *
 * `fbevents.js` rejects anything that is not an ISO 4217 alpha-3 code (`USD`, not `usd`,
 * `$`, or `US Dollar`). Pair `value` with this helper so a conversion never ships amount
 * without a valid currency.
 */

export const META_DEFAULT_CURRENCY = "USD"

const ISO_4217_ALPHA = /^[A-Z]{3}$/

function isIso4217CurrencyCode(code: string): boolean {
  if (!ISO_4217_ALPHA.test(code)) return false
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("currency").includes(code)
    }
  } catch {
    // Intl without currency support — fall through to the 3-letter check.
  }
  return true
}

/** ISO 4217 alpha-3 code for Meta events. Invalid / missing values become USD. */
export function metaIsoCurrency(value: unknown): string {
  if (typeof value !== "string") return META_DEFAULT_CURRENCY
  const code = value.trim().toUpperCase()
  return isIso4217CurrencyCode(code) ? code : META_DEFAULT_CURRENCY
}

/** Amount + currency for a Meta `value` parameter, or null when there is no positive amount. */
export function metaValueAndCurrency(
  value: unknown,
  currency?: unknown,
): { value: number; currency: string } | null {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return {
    value: Math.round(amount * 100) / 100,
    currency: metaIsoCurrency(currency),
  }
}

const AW_ID_PATTERN = /^AW-\d+$/
const CONVERSION_SEND_TO_PATTERN = /^AW-\d+\/[A-Za-z0-9_-]+$/

/** GA4 auto / engagement events. Never import these as Google Ads conversions. */
export const GA4_EVENTS_NEVER_IMPORT_AS_ADS_CONVERSIONS = [
  "page_view",
  "add_to_cart",
  "session_start",
  "user_engagement",
] as const

/** The only GA4 event that may be imported as an Ads conversion (optional). */
export const GA4_PURCHASE_EVENT_FOR_ADS_IMPORT = "purchase"

/**
 * True when the Ads account imports GA4 `purchase` as a conversion.
 * The website purchase tag must then stay off so the same order is not counted twice.
 *
 * Set `NEXT_PUBLIC_GOOGLE_ADS_IMPORT_GA4_PURCHASE=true` after importing `purchase`
 * in Google Ads → Goals → Conversions. Leave unset to keep the website (AW) tag.
 */
export function isGa4PurchaseImportedAsAdsConversion(): boolean {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_IMPORT_GA4_PURCHASE?.trim().toLowerCase()
  return raw === "true" || raw === "1"
}

function parseAwIdFromSendTo(raw: string | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed || !CONVERSION_SEND_TO_PATTERN.test(trimmed)) return null
  const awId = trimmed.split("/")[0] ?? ""
  return AW_ID_PATTERN.test(awId) ? awId : null
}

function resolvePurchaseConversionSendTo(): string | null {
  const full = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION?.trim()
  if (full && CONVERSION_SEND_TO_PATTERN.test(full)) return full

  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL?.trim()
  const awId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()
  if (label && awId && AW_ID_PATTERN.test(awId)) {
    return `${awId}/${label}`
  }

  return null
}

export function getGoogleAdsAwId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()
  if (raw && AW_ID_PATTERN.test(raw)) return raw

  return (
    parseAwIdFromSendTo(process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION?.trim()) ??
    parseAwIdFromSendTo(resolvePurchaseConversionSendTo() ?? undefined)
  )
}

export function getGoogleAdsSignupConversionSendTo(): string | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION?.trim()
  if (!raw || !CONVERSION_SEND_TO_PATTERN.test(raw)) return null
  return raw
}

/**
 * Website (AW) purchase conversion send_to.
 * Returns null when GA4 `purchase` is imported as the Ads conversion so the
 * website tag does not double-count the same order.
 */
export function getGoogleAdsPurchaseConversionSendTo(): string | null {
  if (isGa4PurchaseImportedAsAdsConversion()) return null
  return resolvePurchaseConversionSendTo()
}

/** True when gtag.js should load (AW id or a conversion send_to is configured). */
export function isGoogleAdsEnabled(): boolean {
  return Boolean(getGoogleAdsAwId())
}

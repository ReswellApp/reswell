const AW_ID_PATTERN = /^AW-\d+$/
const CONVERSION_SEND_TO_PATTERN = /^AW-\d+\/[A-Za-z0-9_-]+$/

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

export function getGoogleAdsPurchaseConversionSendTo(): string | null {
  return resolvePurchaseConversionSendTo()
}

/** True when gtag.js should load (AW id or a conversion send_to is configured). */
export function isGoogleAdsEnabled(): boolean {
  return Boolean(getGoogleAdsAwId())
}

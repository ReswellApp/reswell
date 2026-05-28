const AW_ID_PATTERN = /^AW-\d+$/
const CONVERSION_SEND_TO_PATTERN = /^AW-\d+\/[A-Za-z0-9_-]+$/

export function getGoogleAdsAwId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()
  if (!raw || !AW_ID_PATTERN.test(raw)) return null
  return raw
}

export function getGoogleAdsSignupConversionSendTo(): string | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION?.trim()
  if (!raw || !CONVERSION_SEND_TO_PATTERN.test(raw)) return null
  return raw
}

export function getGoogleAdsPurchaseConversionSendTo(): string | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION?.trim()
  if (!raw || !CONVERSION_SEND_TO_PATTERN.test(raw)) return null
  return raw
}

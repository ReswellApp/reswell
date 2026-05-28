const AW_ID_PATTERN = /^AW-\d+$/
const SIGNUP_CONVERSION_PATTERN = /^AW-\d+\/[A-Za-z0-9_-]+$/

export function getGoogleAdsAwId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()
  if (!raw || !AW_ID_PATTERN.test(raw)) return null
  return raw
}

export function getGoogleAdsSignupConversionSendTo(): string | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION?.trim()
  if (!raw || !SIGNUP_CONVERSION_PATTERN.test(raw)) return null
  return raw
}

const GA4_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/

/** GA4 web stream measurement id (Admin → Data streams → Web → Measurement ID). */
export function getGa4MeasurementId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim()
  if (!raw || !GA4_MEASUREMENT_ID_PATTERN.test(raw)) return null
  return raw
}

export function isGoogleAnalyticsEnabled(): boolean {
  return Boolean(getGa4MeasurementId())
}

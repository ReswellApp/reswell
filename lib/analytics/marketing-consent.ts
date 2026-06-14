/** localStorage key — set to `"granted"` or `"denied"` by a future cookie banner. */
export const MARKETING_CONSENT_STORAGE_KEY = 'rw_marketing_consent'

export type MarketingConsent = 'granted' | 'denied'

/**
 * Whether marketing/analytics beacons (Klaviyo page views, etc.) may fire.
 * Respects Do Not Track and an explicit stored preference when present.
 */
export function hasMarketingConsent(): boolean {
  if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') {
    return false
  }

  try {
    const stored = localStorage.getItem(MARKETING_CONSENT_STORAGE_KEY)
    if (stored === 'denied') return false
  } catch {
    // localStorage unavailable — allow beacons (same as before)
  }

  return true
}

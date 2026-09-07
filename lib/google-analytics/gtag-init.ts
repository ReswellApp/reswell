/**
 * Site-wide GA4 gtag config.
 *
 * Grouped as `ga4` so page_view / session_start / user_engagement stay on the
 * analytics property. They must not be imported as Google Ads conversions.
 * Purchase for Ads uses the website AW tag, unless GA4 `purchase` is imported
 * (see `isGa4PurchaseImportedAsAdsConversion` in lib/google-ads/config.ts).
 */
export const GA4_GTAG_GROUP = "ga4"

export const GA4_GTAG_CONFIG = {
  groups: GA4_GTAG_GROUP,
} as const

export function buildGoogleAnalyticsConfigCommand(measurementId: string): string {
  return `gtag('config', '${measurementId}', ${JSON.stringify(GA4_GTAG_CONFIG)});`
}

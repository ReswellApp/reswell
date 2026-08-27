/**
 * Site-wide Google Ads gtag config.
 *
 * `send_page_view: false` is required so AW does not emit a page_view on every
 * load. Page-load conversion actions (and PMax goals that include page views)
 * treat those hits as conversions. Conversion linker still runs so gclid is
 * stored on ad landings.
 *
 * Grouped as `ads` so GA4 auto-events (page_view, session_start, user_engagement)
 * stay on the `ga4` group and are not treated as Ads website conversions.
 */
export const GOOGLE_ADS_GTAG_GROUP = "ads"

export const GOOGLE_ADS_GTAG_CONFIG = {
  send_page_view: false,
  conversion_linker: true,
  groups: GOOGLE_ADS_GTAG_GROUP,
} as const

export function buildGoogleAdsConfigCommand(awId: string): string {
  return `gtag('config', '${awId}', ${JSON.stringify(GOOGLE_ADS_GTAG_CONFIG)});`
}

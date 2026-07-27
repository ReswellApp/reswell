import Script from "next/script"

import { getGa4MeasurementId } from "@/lib/google-analytics/config"
import { isGoogleAdsEnabled } from "@/lib/google-ads/config"

/**
 * Site-wide GA4 gtag config. Renders nothing unless
 * NEXT_PUBLIC_GA4_MEASUREMENT_ID is set to a valid G-* id (see .env.example).
 *
 * When Google Ads gtag is already loaded site-wide, this only adds the GA4
 * measurement config — no second gtag.js download.
 */
export function GoogleAnalyticsGtag() {
  const id = getGa4MeasurementId()
  if (!id) return null

  const adsEnabled = isGoogleAdsEnabled()

  return (
    <>
      {!adsEnabled ? (
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="lazyOnload" />
      ) : null}
      <Script id="google-analytics-gtag-init" strategy="lazyOnload">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
${adsEnabled ? "" : "gtag('js', new Date());"}
gtag('config', '${id}');
`}
      </Script>
    </>
  )
}

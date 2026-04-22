import Script from 'next/script'

const AW_ID_PATTERN = /^AW-\d+$/

function getGoogleAdsAwId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()
  if (!raw || !AW_ID_PATTERN.test(raw)) return null
  return raw
}

/**
 * Google Ads global site tag (gtag.js). Renders nothing unless NEXT_PUBLIC_GOOGLE_ADS_ID is set
 * to a valid AW-* measurement ID (see .env.example).
 */
export function GoogleAdsGtag() {
  const id = getGoogleAdsAwId()
  if (!id) return null

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="google-ads-gtag-init" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');
`}
      </Script>
    </>
  )
}

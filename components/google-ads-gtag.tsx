import Script from 'next/script'

import {
  getGoogleAdsAwId,
  getGoogleAdsSignupConversionSendTo,
} from '@/lib/google-ads/config'
import { GOOGLE_ADS_SIGNUP_QUERY_PARAM } from '@/lib/google-ads/sign-up-conversion'

/**
 * Google Ads global site tag (gtag.js). Renders nothing unless NEXT_PUBLIC_GOOGLE_ADS_ID is set
 * to a valid AW-* measurement ID (see .env.example).
 *
 * When NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION is set, also fires the sign-up conversion on
 * first paint if the URL contains {@link GOOGLE_ADS_SIGNUP_QUERY_PARAM}=1 (OAuth / email confirm).
 */
export function GoogleAdsGtag() {
  const id = getGoogleAdsAwId()
  if (!id) return null

  const signupSendTo = getGoogleAdsSignupConversionSendTo()
  const signupInline = signupSendTo
    ? `
(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.get('${GOOGLE_ADS_SIGNUP_QUERY_PARAM}') !== '1') return;
    var dedupKey = 'rw_google_ads_signup_reported';
    if (sessionStorage.getItem(dedupKey) === '1') return;
    sessionStorage.setItem(dedupKey, '1');
    gtag('event', 'conversion', {
      send_to: '${signupSendTo}',
      value: 1.0,
      currency: 'USD'
    });
  } catch (e) {}
})();`
    : ''

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="google-ads-gtag-init" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');
${signupInline}
`}
      </Script>
    </>
  )
}

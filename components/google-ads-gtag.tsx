import Script from 'next/script'

import {
  getGoogleAdsAwId,
  getGoogleAdsSignupConversionSendTo,
} from '@/lib/google-ads/config'
import { GOOGLE_SIGN_UP_SUCCESS_PATH } from '@/lib/google-ads/sign-up-success-path'

/**
 * Google Ads global site tag (gtag.js). Renders nothing unless NEXT_PUBLIC_GOOGLE_ADS_ID is set
 * to a valid AW-* measurement ID (see .env.example).
 *
 * Fires the sign-up conversion when the user lands on {@link GOOGLE_SIGN_UP_SUCCESS_PATH}.
 */
export function GoogleAdsGtag() {
  const id = getGoogleAdsAwId()
  if (!id) return null

  const signupSendTo = getGoogleAdsSignupConversionSendTo()
  const signupInline = signupSendTo
    ? `
(function () {
  try {
    if (window.location.pathname !== '${GOOGLE_SIGN_UP_SUCCESS_PATH}') return;
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

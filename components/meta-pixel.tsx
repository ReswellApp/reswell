import Script from 'next/script'

import { getMetaPixelId } from '@/lib/meta/pixel-config'

/**
 * Meta (Facebook) Pixel base snippet. Renders nothing unless NEXT_PUBLIC_META_PIXEL_ID is set
 * to a numeric pixel ID (see .env.example).
 *
 * `lazyOnload` keeps fbevents.js off the first-paint path. SPA PageViews are
 * consolidated in {@link MarketingPageViewTracker}.
 *
 * `autoConfig` is off so the pixel does not scrape `$1,250`-style prices from the DOM
 * and fire automatic events with currency `$` (Meta: "Invalid parameter format for currency").
 * ViewContent / AddToCart / Purchase are sent explicitly with ISO 4217 codes.
 */
export function MetaPixel() {
  const id = getMetaPixelId()
  if (!id) return null

  return (
    <>
      <Script id="meta-pixel" strategy="lazyOnload">
        {`
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('set', 'autoConfig', false, '${id}');
fbq('init', '${id}');
fbq('track', 'PageView');
`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element -- Meta Pixel noscript fallback */}
        <img
          alt=""
          height={1}
          width={1}
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  )
}

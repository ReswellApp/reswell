import Script from 'next/script'

import { getKlaviyoCompanyId } from '@/lib/klaviyo/onsite-config'

/**
 * Klaviyo onsite.js — required for embedded forms, SMS signup widgets, and client-side
 * `window.klaviyo` calls. Renders nothing unless NEXT_PUBLIC_KLAVIYO_COMPANY_ID is set.
 */
export function KlaviyoOnsite() {
  const companyId = getKlaviyoCompanyId()
  if (!companyId) return null

  return (
    <>
      <Script
        src={`https://static.klaviyo.com/onsite/js/${companyId}/klaviyo.js?company_id=${companyId}`}
        strategy="afterInteractive"
      />
      <Script id="klaviyo-onsite-init" strategy="afterInteractive">
        {`
!function(){if(!window.klaviyo){window._klOnsite=window._klOnsite||[];try{window.klaviyo=new Proxy({},{get:function(n,i){return"push"===i?function(){var n;(n=window._klOnsite).push.apply(n,arguments)}:function(){for(var n=arguments.length,o=new Array(n),w=0;w<n;w++)o[w]=arguments[w];var t="function"==typeof o[o.length-1]?o.pop():void 0,e=new Promise((function(n){window._klOnsite.push([i].concat(o,[function(i){t&&t(i),n(i)}]))}));return e}}})}catch(n){window.klaviyo=window.klaviyo||[],window.klaviyo.push=function(){var n;(n=window._klOnsite).push.apply(n,arguments)}}}}();
`}
      </Script>
    </>
  )
}

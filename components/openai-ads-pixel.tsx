import Script from "next/script"

import {
  getOpenAiAdsPixelId,
  isOpenAiAdsPixelDebugEnabled,
} from "@/lib/openai-ads/pixel-config"

/**
 * ChatGPT Ads Measurement Pixel base snippet. Renders nothing unless
 * NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID is set (see .env.example).
 *
 * Init captures the `oppref` click reference from ChatGPT ad landings. `page_viewed`
 * is not auto-fired by the SDK, so the first full page load is measured here.
 */
export function OpenAiAdsPixel() {
  const id = getOpenAiAdsPixelId()
  if (!id) return null

  const debug = isOpenAiAdsPixelDebugEnabled()

  return (
    <Script id="openai-ads-pixel" strategy="afterInteractive">
      {`
!function(w,d,s,u){if(w.oaiq)return;var q=function(){q.q.push(arguments)};q.q=[];w.oaiq=q;var j=d.createElement(s);j.async=1;j.src=u;var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(j,f)}(window,document,"script","https://bzrcdn.openai.com/sdk/oaiq.min.js");
oaiq("init",{pixelId:${JSON.stringify(id)},debug:${debug ? "true" : "false"}});
oaiq("measure","page_viewed",{type:"contents",contents:[{id:"page",name:document.title||"Reswell",content_type:"page"}]});
`}
    </Script>
  )
}

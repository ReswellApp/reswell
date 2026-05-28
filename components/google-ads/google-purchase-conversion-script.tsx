import Script from "next/script"

import { getGoogleAdsAwId } from "@/lib/google-ads/config"
import { buildPurchaseConversionInlineScript } from "@/lib/google-ads/purchase-conversion-inline"

interface GooglePurchaseConversionScriptProps {
  orderId: string
  value: number
  currency?: string
}

/**
 * Fires the Google Ads purchase conversion from an inline script (before React hydration).
 * Tag Assistant and page-load diagnostics rely on this firing early, not only in useEffect.
 */
export function GooglePurchaseConversionScript({
  orderId,
  value,
  currency = "USD",
}: GooglePurchaseConversionScriptProps) {
  if (!getGoogleAdsAwId()) return null

  const inline = buildPurchaseConversionInlineScript({ orderId, value, currency })
  if (!inline) return null

  return (
    <Script id={`google-ads-purchase-${orderId}`} strategy="afterInteractive">
      {inline}
    </Script>
  )
}

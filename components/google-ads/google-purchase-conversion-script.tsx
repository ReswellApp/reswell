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
 * Only mounted on the first checkout landing (`?gads_purchase=1`), once per real order.
 * No-ops when GA4 `purchase` is imported as the Ads conversion (website tag off).
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

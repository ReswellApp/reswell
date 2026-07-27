import Script from "next/script"

import {
  buildGa4PurchaseInlineScript,
  type Ga4PurchaseItemInput,
} from "@/lib/google-analytics/purchase-event-inline"

interface GooglePurchaseEventScriptProps {
  orderId: string
  value: number
  shipping: number
  currency?: string
  items: Ga4PurchaseItemInput[]
}

/** Reports the confirmed order as a deduplicated GA4 ecommerce purchase. */
export function GooglePurchaseEventScript({
  orderId,
  value,
  shipping,
  currency = "USD",
  items,
}: GooglePurchaseEventScriptProps) {
  const inline = buildGa4PurchaseInlineScript({
    orderId,
    value,
    shipping,
    currency,
    items,
  })
  if (!inline) return null

  return (
    <Script id={`google-analytics-purchase-${orderId}`} strategy="afterInteractive">
      {inline}
    </Script>
  )
}

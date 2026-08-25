import Script from "next/script"

import { getOpenAiAdsPixelId } from "@/lib/openai-ads/pixel-config"
import {
  buildOpenAiAdsPurchaseInlineScript,
  type OpenAiAdsPurchaseItemInput,
} from "@/lib/openai-ads/purchase-event-inline"

interface OpenAiAdsPurchaseEventScriptProps {
  orderId: string
  value: number
  currency?: string
  items?: OpenAiAdsPurchaseItemInput[]
}

/**
 * Fires the ChatGPT Ads `order_created` event from an inline script so Ads Manager
 * sees it on the first checkout landing, deduped once per order.
 */
export function OpenAiAdsPurchaseEventScript({
  orderId,
  value,
  currency = "USD",
  items,
}: OpenAiAdsPurchaseEventScriptProps) {
  if (!getOpenAiAdsPixelId()) return null

  const inline = buildOpenAiAdsPurchaseInlineScript({ orderId, value, currency, items })
  if (!inline) return null

  return (
    <Script id={`openai-ads-purchase-${orderId}`} strategy="afterInteractive">
      {inline}
    </Script>
  )
}

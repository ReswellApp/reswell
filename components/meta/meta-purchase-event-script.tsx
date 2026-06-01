import Script from "next/script"

import { getMetaPixelId } from "@/lib/meta/pixel-config"
import { buildMetaPurchaseInlineScript } from "@/lib/meta/purchase-event-inline"

interface MetaPurchaseEventScriptProps {
  orderId: string
  value: number
  currency?: string
  /** Listing UUIDs, aligned with the Meta catalog feed product ids. */
  contentIds?: string[]
}

/**
 * Fires the Meta Pixel Purchase event from an inline script (before React hydration) so
 * Events Manager and Pixel Helper see it on page load, deduped once per order.
 */
export function MetaPurchaseEventScript({
  orderId,
  value,
  currency = "USD",
  contentIds,
}: MetaPurchaseEventScriptProps) {
  if (!getMetaPixelId()) return null

  const inline = buildMetaPurchaseInlineScript({ orderId, value, currency, contentIds })
  if (!inline) return null

  return (
    <Script id={`meta-purchase-${orderId}`} strategy="afterInteractive">
      {inline}
    </Script>
  )
}

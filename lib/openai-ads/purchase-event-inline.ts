import { getOpenAiAdsPixelId } from "@/lib/openai-ads/pixel-config"

export const OPENAI_ADS_PURCHASE_DEDUP_PREFIX = "rw_openai_ads_purchase_reported"

export function openAiAdsPurchaseDedupKey(orderId: string): string {
  return `${OPENAI_ADS_PURCHASE_DEDUP_PREFIX}_${orderId.trim()}`
}

export function openAiAdsPurchaseEventId(orderId: string): string {
  return `order_${orderId.trim()}`
}

export interface OpenAiAdsPurchaseItemInput {
  itemId: string | null
  itemName: string
  quantity: number
}

function safeInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

/**
 * Inline JS that polls for `oaiq` and fires `order_created` once per order.
 * `amount` is ISO 4217 minor units (cents). `event_id` is reserved for CAPI dedup.
 */
export function buildOpenAiAdsPurchaseInlineScript(options: {
  orderId: string
  value: number
  currency?: string
  items?: OpenAiAdsPurchaseItemInput[]
}): string | null {
  if (!getOpenAiAdsPixelId()) return null

  const orderId = options.orderId.trim()
  const value = Number(options.value)
  const amount = Math.round(value * 100)
  if (!orderId || !Number.isFinite(value) || amount <= 0) return null

  const currency = options.currency?.trim().toUpperCase() || "USD"
  const contents = (options.items ?? [])
    .map((item) => ({
      id: item.itemId?.trim() ?? "",
      name: item.itemName.trim(),
      content_type: "product" as const,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    }))
    .filter((item) => item.id && item.name)

  const eventData: Record<string, unknown> = {
    type: "contents",
    amount,
    currency,
  }
  if (contents.length > 0) {
    eventData.contents = contents
  }

  const dedupKey = openAiAdsPurchaseDedupKey(orderId)
  const eventId = openAiAdsPurchaseEventId(orderId)

  return `
(function () {
  try {
    var dedupKey = ${safeInlineJson(dedupKey)};
    if (sessionStorage.getItem(dedupKey) === '1') return;

    var eventData = ${safeInlineJson(eventData)};
    var eventId = ${safeInlineJson(eventId)};

    function fire() {
      if (typeof oaiq !== 'function') return false;
      sessionStorage.setItem(dedupKey, '1');
      oaiq('measure', 'order_created', eventData, { event_id: eventId });
      return true;
    }

    if (fire()) return;

    var attempts = 0;
    var timer = setInterval(function () {
      if (fire() || ++attempts >= 300) clearInterval(timer);
    }, 50);
  } catch (e) {}
})();`
}

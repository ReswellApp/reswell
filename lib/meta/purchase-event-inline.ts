import { getMetaPixelId } from "@/lib/meta/pixel-config"
import { metaPurchaseEventId } from "@/lib/meta/event-id"

export const META_PURCHASE_DEDUP_PREFIX = "rw_meta_purchase_reported"

export function metaPurchaseDedupKey(orderId: string): string {
  return `${META_PURCHASE_DEDUP_PREFIX}_${orderId.trim()}`
}

/**
 * Inline JS that polls for `fbq` and fires the Meta Pixel Purchase event once per order.
 * `content_ids` are listing UUIDs so the conversion matches the Meta Commerce catalog feed.
 */
export function buildMetaPurchaseInlineScript(options: {
  orderId: string
  value: number
  currency?: string
  contentIds?: string[]
}): string | null {
  if (!getMetaPixelId()) return null

  const orderId = options.orderId.trim()
  const value = Number(options.value)
  if (!orderId || !Number.isFinite(value) || value <= 0) return null

  const currency = (options.currency?.trim().toUpperCase() || "USD").replace(/'/g, "\\'")
  const dedupKey = metaPurchaseDedupKey(orderId).replace(/'/g, "\\'")
  const eventId = metaPurchaseEventId(orderId).replace(/'/g, "\\'")
  const contentIds = (options.contentIds ?? [])
    .map((id) => String(id ?? "").trim())
    .filter(Boolean)
  // UUIDs only; JSON.stringify is safe to inline and escapes nothing dangerous.
  const contentIdsJson = JSON.stringify(contentIds)

  return `
(function () {
  try {
    var dedupKey = '${dedupKey}';
    if (sessionStorage.getItem(dedupKey) === '1') return;

    var value = ${Math.round(value * 100) / 100};
    var currency = '${currency}';
    var contentIds = ${contentIdsJson};
    var eventId = '${eventId}';

    function fire() {
      if (typeof fbq !== 'function') return false;
      sessionStorage.setItem(dedupKey, '1');
      var params = { value: value, currency: currency, content_type: 'product' };
      if (contentIds.length) params.content_ids = contentIds;
      // eventID dedupes this browser event against the Conversions API Purchase.
      fbq('track', 'Purchase', params, { eventID: eventId });
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

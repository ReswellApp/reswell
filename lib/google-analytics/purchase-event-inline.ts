import { getGa4MeasurementId } from "@/lib/google-analytics/config"

const GA4_PURCHASE_DEDUP_PREFIX = "rw_ga4_purchase_reported"

export interface Ga4PurchaseItemInput {
  itemId: string | null
  itemName: string
  itemCategory?: string | null
  price: number
  quantity: number
}

function purchaseDedupKey(orderId: string): string {
  return `${GA4_PURCHASE_DEDUP_PREFIX}_${orderId.trim()}`
}

function safeInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

/** Inline JS that waits for gtag and reports one GA4 ecommerce purchase per order. */
export function buildGa4PurchaseInlineScript(options: {
  orderId: string
  value: number
  shipping: number
  currency?: string
  items: Ga4PurchaseItemInput[]
}): string | null {
  const measurementId = getGa4MeasurementId()
  const orderId = options.orderId.trim()
  const value = Number(options.value)
  if (!measurementId || !orderId || !Number.isFinite(value) || value <= 0) return null

  const validItems = options.items
    .map((item) => ({
      item_id: item.itemId?.trim() ?? "",
      item_name: item.itemName.trim(),
      item_category: item.itemCategory?.trim() || undefined,
      price: Math.max(0, Number(item.price) || 0),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    }))
    .filter((item) => item.item_id && item.item_name)

  if (validItems.length === 0) return null

  const itemSubtotal = validItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const revenueScale = itemSubtotal > 0 ? value / itemSubtotal : 1
  const items = validItems.map((item) => ({
    ...item,
    price: Math.round(item.price * revenueScale * 100) / 100,
  }))

  const payload = {
    send_to: measurementId,
    transaction_id: orderId,
    value: Math.round(value * 100) / 100,
    shipping: Math.max(0, Math.round((Number(options.shipping) || 0) * 100) / 100),
    currency: options.currency?.trim().toUpperCase() || "USD",
    items,
  }
  const dedupKey = purchaseDedupKey(orderId)

  return `
(function () {
  var dedupKey = ${safeInlineJson(dedupKey)};
  var payload = ${safeInlineJson(payload)};

  function wasReported() {
    try { return sessionStorage.getItem(dedupKey) === '1'; } catch (e) { return false; }
  }

  function markReported() {
    try { sessionStorage.setItem(dedupKey, '1'); } catch (e) {}
  }

  function fire() {
    if (wasReported()) return true;
    if (typeof window.gtag !== 'function') return false;
    markReported();
    window.gtag('event', 'purchase', payload);
    return true;
  }

  if (fire()) return;

  var attempts = 0;
  var timer = setInterval(function () {
    if (fire() || ++attempts >= 300) clearInterval(timer);
  }, 50);
})();`
}

import { getGoogleAdsPurchaseConversionSendTo } from "@/lib/google-ads/config"

export const PURCHASE_CONVERSION_DEDUP_PREFIX = "rw_google_ads_purchase_reported"

export function purchaseConversionDedupKey(orderId: string): string {
  return `${PURCHASE_CONVERSION_DEDUP_PREFIX}_${orderId.trim()}`
}

/** Inline JS that polls for gtag and fires the purchase conversion once per order. */
export function buildPurchaseConversionInlineScript(options: {
  orderId: string
  value: number
  currency?: string
}): string | null {
  const sendTo = getGoogleAdsPurchaseConversionSendTo()
  const orderId = options.orderId.trim()
  const value = Number(options.value)
  if (!sendTo || !orderId || !Number.isFinite(value) || value <= 0) return null

  const currency = (options.currency?.trim().toUpperCase() || "USD").replace(/'/g, "\\'")
  const dedupKey = purchaseConversionDedupKey(orderId).replace(/'/g, "\\'")
  const safeOrderId = orderId.replace(/'/g, "\\'")
  const safeSendTo = sendTo.replace(/'/g, "\\'")

  return `
(function () {
  try {
    var dedupKey = '${dedupKey}';
    if (sessionStorage.getItem(dedupKey) === '1') return;

    var sendTo = '${safeSendTo}';
    var orderId = '${safeOrderId}';
    var value = ${value};
    var currency = '${currency}';

    function fire() {
      if (typeof gtag !== 'function') return false;
      sessionStorage.setItem(dedupKey, '1');
      gtag('event', 'conversion', {
        send_to: sendTo,
        transaction_id: orderId,
        value: value,
        currency: currency
      });
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

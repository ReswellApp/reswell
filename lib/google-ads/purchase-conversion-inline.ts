import { getGoogleAdsPurchaseConversionSendTo } from "@/lib/google-ads/config"

export const PURCHASE_CONVERSION_DEDUP_PREFIX = "rw_google_ads_purchase_reported"

export function purchaseConversionDedupKey(orderId: string): string {
  return `${PURCHASE_CONVERSION_DEDUP_PREFIX}_${orderId.trim()}`
}

function purchaseConversionCookieName(orderId: string): string {
  return `rw_gads_p_${orderId.trim()}`
}

function storageGet(key: string): boolean {
  try {
    if (window.localStorage.getItem(key) === "1") return true
  } catch {
    /* private mode */
  }
  try {
    if (window.sessionStorage.getItem(key) === "1") return true
  } catch {
    /* private mode */
  }
  return false
}

function storageSet(key: string): void {
  try {
    window.localStorage.setItem(key, "1")
  } catch {
    /* private mode */
  }
  try {
    window.sessionStorage.setItem(key, "1")
  } catch {
    /* private mode */
  }
}

function cookieIsSet(name: string): boolean {
  if (typeof document === "undefined") return false
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?:^|; )${escaped}=1(?:;|$)`).test(document.cookie)
}

function cookieSet(name: string): void {
  if (typeof document === "undefined") return
  document.cookie = `${name}=1; max-age=31536000; path=/; samesite=lax`
}

export function hasReportedPurchaseConversion(orderId: string): boolean {
  const trimmed = orderId.trim()
  if (!trimmed || typeof window === "undefined") return false
  const key = purchaseConversionDedupKey(trimmed)
  if (storageGet(key)) return true
  return cookieIsSet(purchaseConversionCookieName(trimmed))
}

export function markPurchaseConversionReported(orderId: string): void {
  const trimmed = orderId.trim()
  if (!trimmed || typeof window === "undefined") return
  storageSet(purchaseConversionDedupKey(trimmed))
  cookieSet(purchaseConversionCookieName(trimmed))
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
  const cookieName = purchaseConversionCookieName(orderId).replace(/'/g, "\\'")
  const safeOrderId = orderId.replace(/'/g, "\\'")
  const safeSendTo = sendTo.replace(/'/g, "\\'")

  return `
(function () {
  try {
    var dedupKey = '${dedupKey}';
    var cookieName = '${cookieName}';

    function wasReported() {
      try { if (localStorage.getItem(dedupKey) === '1') return true; } catch (e) {}
      try { if (sessionStorage.getItem(dedupKey) === '1') return true; } catch (e) {}
      return document.cookie.indexOf(cookieName + '=1') !== -1;
    }

    function markReported() {
      try { localStorage.setItem(dedupKey, '1'); } catch (e) {}
      try { sessionStorage.setItem(dedupKey, '1'); } catch (e) {}
      document.cookie = cookieName + '=1; max-age=31536000; path=/; samesite=lax';
    }

    if (wasReported()) return;
    markReported();

    var sendTo = '${safeSendTo}';
    var orderId = '${safeOrderId}';
    var value = ${value};
    var currency = '${currency}';

    function fire() {
      if (typeof gtag !== 'function') return false;
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

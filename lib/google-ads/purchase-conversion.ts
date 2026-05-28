import { getGoogleAdsPurchaseConversionSendTo } from "@/lib/google-ads/config"
import { purchaseConversionDedupKey } from "@/lib/google-ads/purchase-conversion-inline"

const GTAG_WAIT_MS = 8_000
const GTAG_POLL_MS = 50
const CONVERSION_CALLBACK_TIMEOUT_MS = 2_000

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

function purchaseDedupKey(orderId: string): string {
  return purchaseConversionDedupKey(orderId)
}

export function hasReportedPurchaseConversion(orderId: string): boolean {
  const trimmed = orderId.trim()
  if (!trimmed) return false
  try {
    return sessionStorage.getItem(purchaseDedupKey(trimmed)) === "1"
  } catch {
    return false
  }
}

function markPurchaseConversionReported(orderId: string): void {
  const trimmed = orderId.trim()
  if (!trimmed) return
  try {
    sessionStorage.setItem(purchaseDedupKey(trimmed), "1")
  } catch {
    /* private mode / blocked storage */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForGtag(maxMs = GTAG_WAIT_MS): Promise<NonNullable<Window["gtag"]> | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    if (typeof window.gtag === "function") return window.gtag
    await sleep(GTAG_POLL_MS)
  }
  return null
}

export type ReportPurchaseConversionOptions = {
  orderId: string
  value: number
  currency?: string
  onComplete?: () => void
  gtagWaitMs?: number
  callbackTimeoutMs?: number
}

function firePurchaseConversionEvent(
  gtag: NonNullable<Window["gtag"]>,
  sendTo: string,
  orderId: string,
  value: number,
  currency: string,
  onComplete?: () => void,
): void {
  gtag("event", "conversion", {
    send_to: sendTo,
    transaction_id: orderId,
    value,
    currency,
    event_callback: () => {
      onComplete?.()
    },
  })
}

/**
 * Fires the Google Ads purchase conversion once per order.
 * Requires `transaction_id` for accurate purchase reporting in Google Ads.
 */
export async function reportPurchaseConversion(
  options: ReportPurchaseConversionOptions,
): Promise<boolean> {
  if (typeof window === "undefined") return false

  const orderId = options.orderId.trim()
  if (!orderId) return false

  const sendTo = getGoogleAdsPurchaseConversionSendTo()
  if (!sendTo) return false

  const value = Number(options.value)
  if (!Number.isFinite(value) || value <= 0) return false

  const currency = options.currency?.trim().toUpperCase() || "USD"

  if (hasReportedPurchaseConversion(orderId)) return true

  const gtag = await waitForGtag(options.gtagWaitMs ?? GTAG_WAIT_MS)
  if (!gtag) return false

  if (hasReportedPurchaseConversion(orderId)) return true
  markPurchaseConversionReported(orderId)

  const callbackTimeoutMs =
    options.callbackTimeoutMs ?? CONVERSION_CALLBACK_TIMEOUT_MS

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }

    firePurchaseConversionEvent(gtag, sendTo, orderId, value, currency, () => {
      options.onComplete?.()
      finish()
    })

    window.setTimeout(finish, callbackTimeoutMs)
  })

  return true
}

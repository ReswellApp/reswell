import { carrierTrackingIndicatesScanned } from "./carrier-status-display.ts"
import type { OrderTrackingDetail } from "./order-tracking-detail.ts"

/** Carrier messages that mean the label exists but the package was not handed over. */
const PRE_SCAN_EVENT =
  /label created|shipping label created|electronic shipping|shipment information sent|pre-?shipment|information received|not yet in system|awaiting item|waiting for (the )?package|label printed|shipper created/i

/** Carrier messages that mean a physical scan happened. */
const POSSESSION_EVENT =
  /accepted|picked up|pickup scan|possession|arrived at|departed|in transit|out for delivery|delivered|processed through|origin scan|destination scan|package received/i

/**
 * True only after a carrier has the package.
 * Label-created and "information received" events stay false so unused postage can still be voided.
 */
export function shipEngineTrackingIndicatesPhysicalScan(
  detail: OrderTrackingDetail | null | undefined,
): boolean {
  if (!detail) return false
  if (carrierTrackingIndicatesScanned(detail)) return true

  for (const event of detail.events ?? []) {
    const text = event.description?.trim() ?? ""
    if (!text || PRE_SCAN_EVENT.test(text)) continue
    if (POSSESSION_EVENT.test(text)) return true
  }
  return false
}

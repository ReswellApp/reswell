/** Four-day hold after carrier-reported delivery before seller wallet credit. */
export const CARRIER_DELIVERY_PAYOUT_HOLD_DAYS = 4
export const CARRIER_DELIVERY_PAYOUT_HOLD_MS =
  CARRIER_DELIVERY_PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000

export function carrierDeliveryPayoutEligibleAt(carrierDeliveredAt: Date): Date {
  return new Date(carrierDeliveredAt.getTime() + CARRIER_DELIVERY_PAYOUT_HOLD_MS)
}

export function carrierDeliveryPayoutHoldElapsed(
  carrierDeliveredAt: Date | string | null | undefined,
  referenceTime: Date = new Date(),
): boolean {
  if (!carrierDeliveredAt) return false
  const at =
    carrierDeliveredAt instanceof Date
      ? carrierDeliveredAt
      : new Date(String(carrierDeliveredAt).trim())
  if (!Number.isFinite(at.getTime())) return false
  return referenceTime.getTime() >= carrierDeliveryPayoutEligibleAt(at).getTime()
}

export function msUntilCarrierPayoutRelease(
  carrierDeliveredAt: Date | string | null | undefined,
  referenceTime: Date = new Date(),
): number | null {
  if (!carrierDeliveredAt) return null
  const at =
    carrierDeliveredAt instanceof Date
      ? carrierDeliveredAt
      : new Date(String(carrierDeliveredAt).trim())
  if (!Number.isFinite(at.getTime())) return null
  return Math.max(0, carrierDeliveryPayoutEligibleAt(at).getTime() - referenceTime.getTime())
}

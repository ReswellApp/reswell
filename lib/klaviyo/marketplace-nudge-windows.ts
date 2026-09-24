/** Hours before `offers.expires_at` when we emit **Offer Expiring** once. */
export const OFFER_EXPIRING_LEAD_MS = 12 * 60 * 60 * 1000

/** How long a confirmed order sits before a ship or pickup reminder. */
export const FULFILLMENT_REMINDER_AFTER_MS = 48 * 60 * 60 * 1000

/** Stop reminding once the order is past the shipping deadline plus a day of slack. */
export const FULFILLMENT_REMINDER_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000

export function offerIsInExpiringWindow(expiresAt: string, now: Date): boolean {
  const exp = new Date(expiresAt).getTime()
  if (!Number.isFinite(exp)) return false
  const remaining = exp - now.getTime()
  return remaining > 0 && remaining <= OFFER_EXPIRING_LEAD_MS
}

export function orderIsInFulfillmentReminderWindow(createdAt: string, now: Date): boolean {
  const created = new Date(createdAt).getTime()
  if (!Number.isFinite(created)) return false
  const age = now.getTime() - created
  return age >= FULFILLMENT_REMINDER_AFTER_MS && age <= FULFILLMENT_REMINDER_MAX_AGE_MS
}

export function hoursUntil(iso: string, now: Date): number {
  const target = new Date(iso).getTime()
  if (!Number.isFinite(target)) return 0
  const hours = Math.ceil((target - now.getTime()) / (60 * 60 * 1000))
  return Math.max(1, hours)
}

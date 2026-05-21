/** Days after purchase confirmation before an unshipped shipping order is auto-cancelled. */
export const SHIPPING_DEADLINE_DAYS = 7

export function getShippingDeadlineDate(
  createdAt: Date | string,
): Date {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt
  const deadline = new Date(created.getTime())
  deadline.setUTCDate(deadline.getUTCDate() + SHIPPING_DEADLINE_DAYS)
  return deadline
}

export function isPastShippingDeadline(
  createdAt: Date | string,
  referenceTime: Date = new Date(),
): boolean {
  return referenceTime >= getShippingDeadlineDate(createdAt)
}

/** Whole days remaining until the shipping deadline (0 when due or overdue). */
export function daysUntilShippingDeadline(
  createdAt: Date | string,
  referenceTime: Date = new Date(),
): number {
  const deadline = getShippingDeadlineDate(createdAt)
  const ms = deadline.getTime() - referenceTime.getTime()
  if (ms <= 0) return 0
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function isEligibleForShippingDeadlineAutoCancel(order: {
  status: string
  fulfillment_method: string | null
  delivery_status: string
}): boolean {
  return (
    order.status === "confirmed" &&
    order.fulfillment_method === "shipping" &&
    order.delivery_status === "pending"
  )
}

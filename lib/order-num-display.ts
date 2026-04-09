/**
 * Customer-facing order reference: always prefer `orders.order_num`.
 * Falls back to a short code derived from the UUID only if `order_num` is missing.
 */
export function formatOrderNumForCustomer(
  orderNum: string | null | undefined,
  orderId: string,
): string {
  const t = orderNum?.trim()
  if (t) return t
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase()
}

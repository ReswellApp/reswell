const ORDER_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isLikelyOrderUuid(id: string): boolean {
  return ORDER_UUID_RE.test(id.trim())
}

export function orderIdFromSellerSaleLedger(tx: {
  reference_type?: string | null
  reference_id?: string | null
}): string | null {
  const rt = tx.reference_type
  if (rt !== "order_pending_earnings" && rt !== "order_seller_earnings") return null
  const rid = typeof tx.reference_id === "string" ? tx.reference_id.trim() : ""
  return rid || null
}

export function saleHrefForOrderId(orderId: string): string {
  return `/dashboard/sales/${orderId}`
}

export function purchaseHrefForOrderId(orderId: string): string {
  return `/dashboard/purchases/${orderId}`
}

/** Sale page for seller earnings; purchase page for buyer wallet refunds. */
export function orderDetailPathFromLedgerTx(tx: {
  saleHref?: string | null
  reference_type?: string | null
  reference_id?: string | null
}): string | null {
  if (typeof tx.saleHref === "string" && tx.saleHref.trim()) return tx.saleHref
  const rid = typeof tx.reference_id === "string" ? tx.reference_id.trim() : ""
  if (!rid || !isLikelyOrderUuid(rid)) return null
  const rt = tx.reference_type ?? ""
  if (rt === "order_pending_earnings" || rt === "order_seller_earnings") {
    return saleHrefForOrderId(rid)
  }
  if (rt === "wallet_refund") {
    return purchaseHrefForOrderId(rid)
  }
  return null
}

/** Query param on the first checkout landing so purchase pixels fire once, not on receipt revisits. */
export const GOOGLE_ADS_PURCHASE_QUERY_PARAM = "gads_purchase"

export function buildOrderSuccessPath(
  orderId: string,
  options?: { reportPurchase?: boolean },
): string {
  const id = orderId.trim()
  const path = `/successpage/${encodeURIComponent(id)}`
  if (!id || !options?.reportPurchase) return path
  return `${path}?${GOOGLE_ADS_PURCHASE_QUERY_PARAM}=1`
}

export function searchParamsReportPurchaseConversion(
  searchParams: Record<string, string | string[] | undefined>,
): boolean {
  const raw = searchParams[GOOGLE_ADS_PURCHASE_QUERY_PARAM]
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === "1"
}

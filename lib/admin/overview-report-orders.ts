/**
 * Admin overview / BI hides low-value paid orders in April (UTC) so test or
 * nominal checkouts do not skew marketplace reports.
 */

/** Minimum confirmed order amount (USD) shown in April on overview reports. */
export const ADMIN_OVERVIEW_APRIL_MIN_PAID_ORDER_USD = 20

const REPORT_YEAR_START = 2020
const REPORT_YEAR_END = 2030

export type AdminOverviewReportOrderRow = {
  amount: number | null | undefined
  created_at: string | null | undefined
  status: string | null | undefined
}

/** True when a confirmed order should be omitted from overview aggregates. */
export function isHiddenFromAdminOverviewReport(order: AdminOverviewReportOrderRow): boolean {
  if (order.status !== 'confirmed') return false
  const amount = Number(order.amount ?? 0)
  if (!Number.isFinite(amount) || amount >= ADMIN_OVERVIEW_APRIL_MIN_PAID_ORDER_USD) {
    return false
  }
  const created = order.created_at
  if (!created) return false
  return new Date(created).getUTCMonth() === 3
}

/**
 * PostgREST `.or()` filter: include row if amount ≥ min OR created_at falls outside
 * every April window in the report year range (UTC).
 */
export function buildAdminOverviewReportOrdersOrFilter(
  minPaidAmount = ADMIN_OVERVIEW_APRIL_MIN_PAID_ORDER_USD,
): string {
  const outsideApril: string[] = []
  for (let year = REPORT_YEAR_START; year <= REPORT_YEAR_END; year++) {
    outsideApril.push(`created_at.lt.${year}-04-01T00:00:00.000Z`)
    outsideApril.push(`created_at.gte.${year}-05-01T00:00:00.000Z`)
  }
  return `amount.gte.${minPaidAmount},and(${outsideApril.join(',')})`
}

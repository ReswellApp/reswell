/**
 * Full document navigation back to the sale after the seller buys a label.
 *
 * The seller opens the sale, then Buy label, so that page is already in the
 * client router cache. `staleTimes.dynamic` keeps it for 5 minutes, and a soft
 * `router.push` replays Add tracking and Buy label until a manual refresh.
 * A document load renders the purchased label, tracking, and status.
 */
export function navigateAfterSellerLabelPurchase(orderId: string): void {
  window.location.assign(`/dashboard/sales/${encodeURIComponent(orderId)}`)
}

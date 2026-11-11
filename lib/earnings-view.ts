export const EARNINGS_VIEWS = ["pending", "available", "activity", "credit"] as const

export type EarningsView = (typeof EARNINGS_VIEWS)[number]

export function parseEarningsView(value: string | null | undefined): EarningsView | null {
  if (value === "pending" || value === "available" || value === "activity" || value === "credit") {
    return value
  }
  return null
}

/** Pending / available / activity panes need ledger listings; the hub does not. */
export function earningsViewNeedsLedger(view: EarningsView | null): boolean {
  return view === "pending" || view === "available" || view === "activity"
}

export function earningsHref(view?: EarningsView | null): string {
  if (!view) return "/dashboard/earnings"
  return `/dashboard/earnings?view=${view}`
}

/** Available pane, scrolled to the Stripe bank cash-out card. */
export function earningsBankPayoutHref(): string {
  return `${earningsHref("available")}#earnings-bank-payout`
}

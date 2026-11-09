export const EARNINGS_VIEWS = ["pending", "available", "activity", "credit"] as const

export type EarningsView = (typeof EARNINGS_VIEWS)[number]

export function parseEarningsView(value: string | null | undefined): EarningsView | null {
  if (value === "pending" || value === "available" || value === "activity" || value === "credit") {
    return value
  }
  return null
}

export function earningsHref(view?: EarningsView | null): string {
  if (!view) return "/dashboard/earnings"
  return `/dashboard/earnings?view=${view}`
}

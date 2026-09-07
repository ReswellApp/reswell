import type { IntelligenceTrend } from "@/lib/types/businessIntelligence"
import { formatCompactUsd } from "@/lib/utils/format-compact-usd"

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount)
}

export function compactUsd(amount: number): string {
  if (Math.abs(amount) >= 10_000) return formatCompactUsd(amount)
  return formatUsd(amount)
}

export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US")
}

export function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

export function formatDelta(trend: IntelligenceTrend): string | null {
  if (trend.deltaPct === null) return trend.current > 0 ? "new" : null
  const sign = trend.deltaPct > 0 ? "+" : "−"
  const mag = Math.abs(trend.deltaPct)
  return `${sign}${mag >= 10 ? mag.toFixed(0) : mag.toFixed(1)}%`
}

export function formatMonthKey(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number)
  if (!y || !m) return yearMonth
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

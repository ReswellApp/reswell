import type { PriceGuideConfidence, PriceGuideMarketStats } from "@/lib/types/price-guide"

export function moneyUsd(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const raw =
    sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
  return Math.round(raw * 100) / 100
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 100) / 100
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]!
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return Math.round(sorted[lo]! * 100) / 100
  const raw = sorted[lo]! * (hi - idx) + sorted[hi]! * (idx - lo)
  return Math.round(raw * 100) / 100
}

export function statsFromValues(values: number[]): PriceGuideMarketStats {
  const cleaned = values.filter((n) => Number.isFinite(n) && n > 0)
  if (cleaned.length === 0) {
    return {
      min_usd: null,
      max_usd: null,
      avg_usd: null,
      median_usd: null,
      p25_usd: null,
      p75_usd: null,
      count: 0,
    }
  }
  return {
    min_usd: Math.min(...cleaned),
    max_usd: Math.max(...cleaned),
    avg_usd: average(cleaned),
    median_usd: median(cleaned),
    p25_usd: percentile(cleaned, 0.25),
    p75_usd: percentile(cleaned, 0.75),
    count: cleaned.length,
  }
}

export function confidenceFromSample(soldCount: number, askingCount: number): PriceGuideConfidence {
  const weight = soldCount * 2 + askingCount
  if (soldCount >= 20 || weight >= 40) return "solid"
  if (soldCount >= 8 || weight >= 16) return "emerging"
  if (soldCount >= 3 || weight >= 6) return "emerging"
  return "thin"
}

export function typicalRangeFromStats(
  sold: PriceGuideMarketStats,
  asking: PriceGuideMarketStats,
): { low: number | null; mid: number | null; high: number | null } {
  const primary = sold.count > 0 ? sold : asking
  return {
    low: primary.p25_usd ?? primary.min_usd,
    mid: primary.median_usd ?? primary.avg_usd,
    high: primary.p75_usd ?? primary.max_usd,
  }
}

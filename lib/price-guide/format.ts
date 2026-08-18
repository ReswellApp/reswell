import type { PriceGuideConfidence } from "@/lib/types/price-guide"

export function formatGuideUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(value))
}

export function formatGuideUsdRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return "Gathering comps"
  if (low != null && high != null && low !== high) {
    return `${formatGuideUsd(low)} – ${formatGuideUsd(high)}`
  }
  return formatGuideUsd(low ?? high)
}

export function formatCompCount(count: number): string {
  if (count === 1) return "1 sale"
  return `${count.toLocaleString()} sales`
}

export function formatListingCount(count: number): string {
  if (count === 1) return "1 listing"
  return `${count.toLocaleString()} listings`
}

export const PRICE_GUIDE_CONFIDENCE_LABEL: Record<PriceGuideConfidence, string> = {
  thin: "Early data",
  emerging: "Building",
  solid: "Solid",
  expert: "Expert",
}

export const PRICE_GUIDE_CONFIDENCE_HINT: Record<PriceGuideConfidence, string> = {
  thin: "Few public comps so far — treat the range as directional.",
  emerging: "Enough sales to see a pattern. Range will tighten as more boards trade.",
  solid: "A meaningful sample of marketplace sales and asks.",
  expert: "Reviewed by Reswell with market comps and editorial pricing.",
}

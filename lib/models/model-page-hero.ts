import { formatGuideUsd, formatGuideUsdRange } from "@/lib/price-guide/format"

/** Null when the guide is still gathering comps. */
export function modelUsedRangeLabel(
  low: number | null | undefined,
  high: number | null | undefined,
): string | null {
  const label = formatGuideUsdRange(low ?? null, high ?? null)
  return label === "Gathering comps" ? null : label
}

export function lowestListingPrice(prices: readonly number[]): number | null {
  let lowest: number | null = null
  for (const price of prices) {
    if (!Number.isFinite(price) || price <= 0) continue
    if (lowest == null || price < lowest) lowest = price
  }
  return lowest
}

export type ModelPageHeroOffer =
  | { kind: "listing"; supporting: string }
  | { kind: "from"; headline: string; supporting: string }
  | { kind: "range"; headline: string; supporting: string }
  | { kind: "unavailable"; supporting: string }

function singleLead(lengthLabel: string | null, conditionLabel: string | null): string {
  const bits = [lengthLabel, conditionLabel].filter((part): part is string => Boolean(part))
  return bits.length > 0 ? bits.join(" · ") : "For sale"
}

function severalForSale(count: number, usedRange: string | null): string {
  const lead = `${count} for sale`
  if (!usedRange) return lead
  return `${lead} · similar boards sell for ${usedRange}`
}

/**
 * One price story for the header.
 * A board you can buy leads. The used range leads only when nothing is listed.
 */
export function modelPageHeroOffer(input: {
  listingCount: number
  lowestPriceUsd: number | null
  lengthLabel: string | null
  conditionLabel: string | null
  usedRange: string | null
}): ModelPageHeroOffer {
  const { listingCount, lowestPriceUsd, lengthLabel, conditionLabel, usedRange } = input

  if (listingCount === 1 && lowestPriceUsd != null) {
    // The price block sits directly under this header, so the range is not repeated here.
    return { kind: "listing", supporting: singleLead(lengthLabel, conditionLabel) }
  }

  if (listingCount > 1 && lowestPriceUsd != null) {
    return {
      kind: "from",
      headline: `From ${formatGuideUsd(lowestPriceUsd)}`,
      supporting: severalForSale(listingCount, usedRange),
    }
  }

  if (usedRange) {
    return {
      kind: "range",
      headline: usedRange,
      supporting: "None for sale · estimated used value",
    }
  }

  return { kind: "unavailable", supporting: "None listed right now" }
}

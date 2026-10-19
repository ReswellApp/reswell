/** Round USD the same way listing price writes do (two decimal places). */
export function roundCompareAtUsd(n: number): number {
  return Math.round(n * 100) / 100
}

export function parseOptionalUsdAmount(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : Number.parseFloat(String(value).replace(/,/g, ""))
  if (!Number.isFinite(n) || n <= 0) return null
  return roundCompareAtUsd(n)
}

/**
 * Listing price from a sell form or a listings row.
 * Accepts `85`, `"85"`, `"1,200.00"`, and `"$40"` — the shapes the price field can submit.
 */
export function coerceListingPriceUsd(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null
    return roundCompareAtUsd(value)
  }
  if (typeof value !== "string") return null
  const cleaned = value.trim().replace(/\$/g, "").replace(/,/g, "")
  if (!cleaned) return null
  const n = Number.parseFloat(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return roundCompareAtUsd(n)
}

/** Writes a parsed listing price back onto a row so publish checks see the typed amount. */
export function listingFieldsWithCoercedPrice(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const price = coerceListingPriceUsd(fields.price)
  if (price == null) return fields
  return { ...fields, price }
}

/**
 * Compare-at is only shown when the seller opted in and it is strictly above list price.
 */
export function listingCompareAtPriceForDisplay(
  priceUsd: number,
  compareAtPriceUsd: unknown,
): number | null {
  const price = roundCompareAtUsd(priceUsd)
  const compareAt = parseOptionalUsdAmount(compareAtPriceUsd)
  if (compareAt == null || !Number.isFinite(price) || compareAt <= price) return null
  return compareAt
}

export function resolveCompareAtPriceOnUpdate(input: {
  currentPriceUsd: number
  nextPriceUsd: number
  existingCompareAtUsd: number | null
  showPriceMarkdown: boolean
}): number | null {
  const current = roundCompareAtUsd(input.currentPriceUsd)
  const next = roundCompareAtUsd(input.nextPriceUsd)
  const existing =
    input.existingCompareAtUsd != null && Number.isFinite(input.existingCompareAtUsd)
      ? roundCompareAtUsd(input.existingCompareAtUsd)
      : null

  if (!input.showPriceMarkdown) return null

  if (next >= current) {
    if (existing != null && existing > next) return existing
    return null
  }

  const candidate = existing != null && existing > current ? existing : current
  return candidate > next ? candidate : null
}

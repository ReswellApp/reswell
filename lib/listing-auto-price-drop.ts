import {
  parseOptionalUsdAmount,
  resolveCompareAtPriceOnUpdate,
} from "./listing-compare-at-price.ts"

/** Must match the interval in `listings_sync_auto_price_drop_schedule`. */
export const AUTO_PRICE_DROP_DELAY_DAYS = 14

export type ListingAutoPriceDropPlan =
  | {
      action: "drop"
      nextPriceUsd: number
      compareAtPriceUsd: number
    }
  | { action: "clear" }
  | { action: "skip" }

export function parseAutoPriceDropFloor(value: unknown): number | null {
  return parseOptionalUsdAmount(value)
}

export function listingAutoPriceDropDue(input: {
  status: string
  scheduledFor: string | null
  referenceTime: Date
}): boolean {
  if (input.status.trim() !== "active") return false
  if (!input.scheduledFor) return false
  const due = Date.parse(input.scheduledFor)
  if (!Number.isFinite(due)) return false
  return due <= input.referenceTime.getTime()
}

/**
 * Decide whether a due listing should drop to its floor (with markdown)
 * or just clear a stale opt-in.
 */
export function planListingAutoPriceDrop(input: {
  status: string
  priceUsd: unknown
  compareAtPriceUsd: unknown
  floorUsd: unknown
  scheduledFor: string | null
  referenceTime: Date
}): ListingAutoPriceDropPlan {
  if (!listingAutoPriceDropDue(input)) return { action: "skip" }

  const current = parseOptionalUsdAmount(input.priceUsd)
  const floor = parseAutoPriceDropFloor(input.floorUsd)
  if (current == null || floor == null || floor >= current) {
    return { action: "clear" }
  }

  const existingCompareAt = parseOptionalUsdAmount(input.compareAtPriceUsd)
  const compareAtPriceUsd = resolveCompareAtPriceOnUpdate({
    currentPriceUsd: current,
    nextPriceUsd: floor,
    existingCompareAtUsd: existingCompareAt,
    showPriceMarkdown: true,
  })

  if (compareAtPriceUsd == null) return { action: "clear" }

  return {
    action: "drop",
    nextPriceUsd: floor,
    compareAtPriceUsd,
  }
}

/** Strip the server-owned due date so clients cannot schedule an immediate drop. */
export function omitClientAutoPriceDropSchedule(
  listing: Record<string, unknown>,
): Record<string, unknown> {
  const { auto_price_drop_scheduled_for: _ignored, ...rest } = listing
  return rest
}

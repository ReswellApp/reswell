/**
 * Same-seller multi-surfboard checkout (2–3 boards in one carton).
 *
 * Quote and label use the longest bare board length + a fixed packing buffer,
 * with a count-based shortboard-style profile (2 boards: 22 × 5; 3 boards: 27 × 7;
 * 22 lb). Single-board box-length ceilings do not apply to the combined carton.
 */

import { totalBoardLengthInchesFromCombinedInput } from "@/lib/board-measurements"
import { isListingPurchasable } from "@/lib/listing-public-visibility"
import { parseListingDimensionsColumn } from "@/lib/listing-dimensions-storage"
import {
  SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN,
  SURFBOARD_SHIPPING_DIM_FORMULA,
  surfboardShippingDimIn,
} from "@/lib/shipping/surfboard-label-limits"

export const MAX_SURFBOARDS_PER_SELLER_CHECKOUT = 3

/** Extra inches added to the longest board for the shared carton. */
export const MULTI_SURFBOARD_PACK_LENGTH_BUFFER_IN = 4

export const MULTI_SURFBOARD_TWO_BOX_WIDTH_IN = 22
export const MULTI_SURFBOARD_TWO_BOX_HEIGHT_IN = 5
export const MULTI_SURFBOARD_THREE_BOX_WIDTH_IN = 27
export const MULTI_SURFBOARD_THREE_BOX_HEIGHT_IN = 7
export const MULTI_SURFBOARD_BOX_WEIGHT_LB = 22

export const MULTI_SURFBOARD_BUNDLE_MAX_WEIGHT_LB = MULTI_SURFBOARD_BOX_WEIGHT_LB

export function isSurfboardListingSection(section: string | null | undefined): boolean {
  return section?.trim() === "surfboards"
}

export function countSurfboardListings(
  rows: Array<{ section?: string | null }>,
): number {
  return rows.filter((row) => isSurfboardListingSection(row.section)).length
}

export function peerCheckoutSurfboardCountError(count: number): string | null {
  if (count <= MAX_SURFBOARDS_PER_SELLER_CHECKOUT) return null
  return `You can buy up to ${MAX_SURFBOARDS_PER_SELLER_CHECKOUT} surfboards from the same seller in one checkout.`
}

/** Cart row used to decide whether another surfboard from the same seller still fits. */
export type CartSurfboardCapRow = {
  listingId: string
  userId?: string | null
  section?: string | null
  status?: string | null
  title?: string | null
  hiddenFromSite?: boolean | null
  archivedAt?: string | null
}

/**
 * Cap for adding one surfboard. Counts only purchasable boards from that seller.
 * Sold, hidden, and archived cart rows are not in checkout, so they do not count.
 * Re-adding a listing already in the cart is not another board.
 */
export function surfboardCapErrorForAddedListing(
  cartRows: CartSurfboardCapRow[],
  adding: { listingId: string; userId: string; section?: string | null },
): string | null {
  if (!isSurfboardListingSection(adding.section)) return null

  const seen = new Set<string>()
  const sellerBoards: Array<{ section?: string | null }> = []
  for (const row of cartRows) {
    const listingId = row.listingId.trim()
    if (!listingId || seen.has(listingId)) continue
    seen.add(listingId)
    if (row.userId !== adding.userId) continue
    if (
      !isListingPurchasable({
        status: row.status ?? "",
        title: row.title,
        hidden_from_site: row.hiddenFromSite,
        archived_at: row.archivedAt,
      })
    ) {
      continue
    }
    sellerBoards.push({ section: row.section })
  }

  if (seen.has(adding.listingId.trim())) return null
  return peerCheckoutSurfboardCountError(countSurfboardListings(sellerBoards) + 1)
}

export function boardLengthInchesFromListing(row: { dimensions?: string | null }): number | null {
  const parsed = row.dimensions?.trim() ? parseListingDimensionsColumn(row.dimensions) : null
  const lengthText = parsed?.boardLength.trim() ?? ""
  if (!lengthText) return null
  return totalBoardLengthInchesFromCombinedInput(lengthText)
}

export function isMultiSurfboardOneBoxShipment(
  rows: Array<{ section?: string | null }>,
): boolean {
  return countSurfboardListings(rows) >= 2
}

export function multiSurfboardOneBoxLengthIn(longestBoardLengthIn: number): number {
  return Math.ceil(longestBoardLengthIn + MULTI_SURFBOARD_PACK_LENGTH_BUFFER_IN)
}

/** Shared carton width × height from how many surfboards are in the box. */
export function multiSurfboardBoxCrossSection(surfboardCount: number): {
  widthIn: number
  heightIn: number
} {
  if (surfboardCount <= 2) {
    return {
      widthIn: MULTI_SURFBOARD_TWO_BOX_WIDTH_IN,
      heightIn: MULTI_SURFBOARD_TWO_BOX_HEIGHT_IN,
    }
  }
  return {
    widthIn: MULTI_SURFBOARD_THREE_BOX_WIDTH_IN,
    heightIn: MULTI_SURFBOARD_THREE_BOX_HEIGHT_IN,
  }
}

export function validateMultiSurfboardOneBoxParcel(parcel: {
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
}): { ok: true } | { ok: false; error: string } {
  const { lengthIn, widthIn, heightIn, weightLb } = parcel
  if (
    !Number.isFinite(lengthIn) ||
    !Number.isFinite(widthIn) ||
    !Number.isFinite(heightIn) ||
    !Number.isFinite(weightLb)
  ) {
    return { ok: false, error: "Could not size a shipping box for these surfboards." }
  }

  const dimTotal = surfboardShippingDimIn(lengthIn, widthIn, heightIn)
  if (dimTotal > SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN) {
    return {
      ok: false,
      error: `These boards are too long to ship together (${SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN}″ max ${SURFBOARD_SHIPPING_DIM_FORMULA}). Remove a board or choose local pickup.`,
    }
  }

  if (weightLb > MULTI_SURFBOARD_BUNDLE_MAX_WEIGHT_LB) {
    return {
      ok: false,
      error: `These boards are too heavy to ship together (${MULTI_SURFBOARD_BUNDLE_MAX_WEIGHT_LB} lb max). Remove a board or choose local pickup.`,
    }
  }

  return { ok: true }
}

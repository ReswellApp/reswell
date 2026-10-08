import {
  applyDropoffPackedParcelToListingRow,
  matchDropoffBoxRule,
  parseDropoffBoxRules,
} from "@/lib/dropoff-location-box-rules"
import { parseListingDimensionsColumn } from "@/lib/listing-dimensions-storage"
import type { ListingPackedParcelSource } from "@/lib/reswell-packed-parcel-from-listing"

export type DropoffQuoteListing = ListingPackedParcelSource & {
  dropoff_location_id?: string | null
  dropoff_locations?: unknown
  shipping_available?: boolean | null
}

function boxRulesFromListing(listing: DropoffQuoteListing) {
  const raw = listing.dropoff_locations
  const row = Array.isArray(raw) ? raw[0] : raw
  if (!row || typeof row !== "object") return []
  return parseDropoffBoxRules((row as { box_rules?: unknown }).box_rules)
}

/**
 * Quote and buy a drop-off order with that location's box size.
 * Listings without box rules keep their saved carton.
 * A location with rules that the board does not fit is an error, so we do not buy a different box.
 */
export function overlayDropoffBoxesForQuote<T extends DropoffQuoteListing>(
  listings: T[],
): { ok: true; listings: T[] } | { ok: false; error: string } {
  const next: T[] = []
  for (const listing of listings) {
    const id = listing.dropoff_location_id?.trim() ?? ""
    if (!id) {
      next.push(listing)
      continue
    }
    const rules = boxRulesFromListing(listing)
    if (rules.length === 0) {
      next.push(listing)
      continue
    }
    const dims = parseListingDimensionsColumn(listing.dimensions)
    const match = matchDropoffBoxRule(rules, {
      boardLength: dims?.boardLength,
      boardWidthInches: dims?.boardWidthInches,
    })
    if (!match) {
      return { ok: false, error: "This board does not match a drop-off box size." }
    }
    const packed = applyDropoffPackedParcelToListingRow(
      { ...listing, shipping_available: true },
      {
        dropoffLocationId: id,
        boardLength: dims?.boardLength,
        boardWidthInches: dims?.boardWidthInches,
        boxRules: rules,
      },
    )
    next.push(packed as T)
  }
  return { ok: true, listings: next }
}

export type DropoffParcelFormFields = {
  lengthIn: string
  widthIn: string
  heightIn: string
  weightLb: string
  weightOz: string
}

function formatMeasure(n: number): string {
  if (!Number.isFinite(n)) return ""
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

function positiveNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number.parseFloat(value.replace(/,/g, ""))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

/**
 * Packed carton for the admin exact-box form when the listing uses a drop-off location.
 * Returns null when the listing has no drop-off, the location has no box rules, or the board does not fit.
 */
export function suggestedDropoffParcelFromListing(
  listing: DropoffQuoteListing,
): DropoffParcelFormFields | null {
  const id = listing.dropoff_location_id?.trim() ?? ""
  if (!id || boxRulesFromListing(listing).length === 0) return null
  const overlaid = overlayDropoffBoxesForQuote([listing])
  if (!overlaid.ok) return null
  const row = overlaid.listings[0]
  if (!row || row.shipping_package_band != null) return null
  const lengthIn = positiveNum(row.shipping_packed_length_in)
  const widthIn = positiveNum(row.shipping_packed_width_in)
  const heightIn = positiveNum(row.shipping_packed_height_in)
  const totalOz = positiveNum(row.shipping_packed_weight_oz)
  if (lengthIn == null || widthIn == null || heightIn == null || totalOz == null) return null
  const pounds = Math.floor(totalOz / 16)
  const ounces = Math.round((totalOz - pounds * 16) * 100) / 100
  return {
    lengthIn: formatMeasure(lengthIn),
    widthIn: formatMeasure(widthIn),
    heightIn: formatMeasure(heightIn),
    weightLb: String(pounds),
    weightOz: formatMeasure(ounces),
  }
}

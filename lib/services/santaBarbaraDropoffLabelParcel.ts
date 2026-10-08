import type { SupabaseClient } from "@supabase/supabase-js"

import { fetchDropoffLocationById, type DropoffLocationRow } from "@/lib/db/dropoff-locations"
import {
  dropoffRuleToPackageForm,
  matchDropoffBoxRule,
  type DropoffBoxRule,
} from "@/lib/dropoff-location-box-rules"
import {
  SANTA_BARBARA_DROPOFF_LOCATION_ID,
  SANTA_BARBARA_DROPOFF_PHONE_E164,
  SANTA_BARBARA_DROPOFF_SLUG,
  listingUsesSantaBarbaraDropoff,
} from "@/lib/dropoff-santa-barbara"
import { parseListingDimensionsColumn } from "@/lib/listing-dimensions-storage"
import type { ProfileAddressRow } from "@/lib/profile-address"
import {
  dropoffLocationToProfileAddressRow,
  embedFromDropoffLocation,
} from "@/lib/services/dropoffLocationShipFrom"
import type { PeerListingForShippingQuote } from "@/lib/services/peerListingShippingQuote"

/** Form fields for the admin exact-box tool, taken from a dropoff location box rule. */
export type SantaBarbaraExactParcelFields = {
  lengthIn: string
  widthIn: string
  heightIn: string
  weightLb: string
  weightOz: string
  ruleLabel: string
}

type DropoffListing = PeerListingForShippingQuote & { id?: string }

function locationSlug(location: { slug?: string | null } | null | undefined): string {
  return location?.slug?.trim().toLowerCase() ?? ""
}

export function isSantaBarbaraDropoffListing(
  listing: DropoffListing,
  location?: { slug?: string | null } | null,
): boolean {
  if (listingUsesSantaBarbaraDropoff(listing)) return true
  return locationSlug(location) === SANTA_BARBARA_DROPOFF_SLUG
}

export function exactParcelFieldsFromDropoffRules(
  rules: DropoffBoxRule[],
  listing: { dimensions?: string | null },
): SantaBarbaraExactParcelFields | null {
  const parsed = listing.dimensions?.trim()
    ? parseListingDimensionsColumn(listing.dimensions)
    : null
  const match = matchDropoffBoxRule(rules, {
    boardLength: parsed?.boardLength ?? null,
    boardWidthInches: parsed?.boardWidthInches ?? null,
  })
  if (!match) return null
  const form = dropoffRuleToPackageForm(match.rule)
  return {
    lengthIn: form.reswellPackageLengthIn,
    widthIn: form.reswellPackageWidthIn,
    heightIn: form.reswellPackageHeightIn,
    weightLb: form.reswellPackageWeightLb,
    weightOz: form.reswellPackageWeightOz,
    ruleLabel: match.rule.label,
  }
}

/** Rate and buy this listing with the dropoff carton, not a pack-band or seller-entered box. */
export function applyDropoffBoxToListing<T extends PeerListingForShippingQuote>(
  listing: T,
  fields: SantaBarbaraExactParcelFields,
): T {
  const lengthIn = Number(fields.lengthIn)
  const widthIn = Number(fields.widthIn)
  const heightIn = Number(fields.heightIn)
  const weightLb = Number(fields.weightLb)
  const weightOz = Number(fields.weightOz)
  const totalOz =
    (Number.isFinite(weightLb) ? weightLb : 0) * 16 + (Number.isFinite(weightOz) ? weightOz : 0)
  return {
    ...listing,
    shipping_packed_length_in: lengthIn,
    shipping_packed_width_in: widthIn,
    shipping_packed_height_in: heightIn,
    shipping_packed_weight_oz: Math.round(totalOz * 100) / 100,
    shipping_package_band: null,
  }
}

export function santaBarbaraDropoffShipFromProfile(
  location: DropoffLocationRow,
  sellerId: string,
): ProfileAddressRow | null {
  const row = dropoffLocationToProfileAddressRow(embedFromDropoffLocation(location), sellerId)
  if (!row) return null
  return {
    ...row,
    full_name: "Reswell",
    phone: SANTA_BARBARA_DROPOFF_PHONE_E164,
    label: "Santa Barbara drop-off",
    residential: "no",
  }
}

export type SantaBarbaraDropoffLabelPlan =
  | { applies: false }
  | {
      applies: true
      ok: true
      listings: DropoffListing[]
      shipFrom: ProfileAddressRow
      parcel: SantaBarbaraExactParcelFields
      location: DropoffLocationRow
    }
  | { applies: true; ok: false; error: string }

/**
 * Santa Barbara drop-off labels ship from that location, in the carton from its box rules.
 * Seller home addresses and checkout rate ids are not used.
 */
export async function prepareSantaBarbaraDropoffListingsForLabel(params: {
  supabase: SupabaseClient
  sellerId: string
  listings: DropoffListing[]
}): Promise<SantaBarbaraDropoffLabelPlan> {
  const locationIds = new Set<string>()
  for (const listing of params.listings) {
    const id = listing.dropoff_location_id?.trim()
    if (id) locationIds.add(id)
    if (listingUsesSantaBarbaraDropoff(listing)) {
      locationIds.add(SANTA_BARBARA_DROPOFF_LOCATION_ID)
    }
  }
  if (locationIds.size === 0) return { applies: false }

  const locations = new Map<string, DropoffLocationRow | null>()
  for (const id of locationIds) {
    locations.set(id, await fetchDropoffLocationById(params.supabase, id))
  }

  const santaBarbaraListings = params.listings.filter((listing) => {
    const id = listing.dropoff_location_id?.trim() ?? ""
    return isSantaBarbaraDropoffListing(listing, id ? locations.get(id) : null)
  })
  if (santaBarbaraListings.length === 0) return { applies: false }

  const primary = santaBarbaraListings[0]!
  const primaryId = primary.dropoff_location_id?.trim() || SANTA_BARBARA_DROPOFF_LOCATION_ID
  const location =
    locations.get(primaryId) ??
    locations.get(SANTA_BARBARA_DROPOFF_LOCATION_ID) ??
    [...locations.values()].find(
      (row) => row && locationSlug(row) === SANTA_BARBARA_DROPOFF_SLUG,
    ) ??
    null
  if (!location) {
    return {
      applies: true,
      ok: false,
      error: "Santa Barbara drop-off location could not be loaded.",
    }
  }
  if (location.box_rules.length === 0) {
    return {
      applies: true,
      ok: false,
      error: "Santa Barbara drop-off has no box sizes configured.",
    }
  }

  const next: DropoffListing[] = []
  let parcel: SantaBarbaraExactParcelFields | null = null
  for (const listing of params.listings) {
    const id = listing.dropoff_location_id?.trim() ?? ""
    const row = id ? locations.get(id) : null
    if (!isSantaBarbaraDropoffListing(listing, row)) {
      next.push(listing)
      continue
    }
    const rules = row?.box_rules.length ? row.box_rules : location.box_rules
    const matched = exactParcelFieldsFromDropoffRules(rules, listing)
    if (!matched) {
      return {
        applies: true,
        ok: false,
        error:
          "This board does not match a Santa Barbara drop-off box. Check the board length and width against that location's box rules.",
      }
    }
    parcel ??= matched
    next.push(applyDropoffBoxToListing(listing, matched))
  }

  const shipFrom = santaBarbaraDropoffShipFromProfile(location, params.sellerId)
  if (!shipFrom || !parcel) {
    return {
      applies: true,
      ok: false,
      error: "Santa Barbara drop-off is missing a street address for the label.",
    }
  }

  return { applies: true, ok: true, listings: next, shipFrom, parcel, location }
}

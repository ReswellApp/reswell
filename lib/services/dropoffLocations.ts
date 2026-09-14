import { requireAdmin } from "@/lib/brands/admin-server"
import {
  fetchDropoffLocationById,
  listAllDropoffLocations,
  listDropoffLocationListings,
  updateDropoffListingPackedParcel,
  updateDropoffLocationRow,
  type DropoffLocationListingRow,
  type DropoffLocationRow,
} from "@/lib/db/dropoff-locations"
import {
  formatDropoffPackedParcel,
  matchDropoffBoxRule,
} from "@/lib/dropoff-location-box-rules"
import { listingDetailHref } from "@/lib/listing-href"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { formatListingDimensionsLine } from "@/lib/listing-dimensions-display"
import { parseListingDimensionsColumn } from "@/lib/listing-dimensions-storage"
import { parseReswellPackedWeightToTotalOz } from "@/lib/reswell-parcel-fields"
import { reswellPackageFormFromDbRow } from "@/lib/sell-listing-fulfillment-flags"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { withAdminListingEditEntry } from "@/lib/utils/admin-listing-edit-entry"
import type {
  DropoffListingParcelUpdateInput,
  DropoffLocationUpdateInput,
} from "@/lib/validations/dropoff-location"

export type DropoffAdminListing = {
  id: string
  title: string
  status: string
  href: string
  editHref: string
  thumbnailUrl: string
  sellerCity: string | null
  boardDimensions: string
  suggestedBox: string | null
  packedLengthIn: string
  packedWidthIn: string
  packedHeightIn: string
  packedWeightLb: string
  packedWeightOz: string
  currentBox: string
  locationId: string
  locationName: string
}

export type DropoffLocationsAdminDashboard = {
  locations: DropoffLocationRow[]
  listings: DropoffAdminListing[]
}

export async function getDropoffLocationsAdminDashboard(): Promise<
  { ok: true; data: DropoffLocationsAdminDashboard } | { ok: false; error: string }
> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  const db = createServiceRoleClient()
  const [locations, listingRows] = await Promise.all([
    listAllDropoffLocations(db),
    listDropoffLocationListings(db),
  ])
  const locationById = new Map(locations.map((loc) => [loc.id, loc]))

  return {
    ok: true,
    data: {
      locations,
      listings: listingRows.map((row) => mapAdminListing(row, locationById.get(row.dropoff_location_id) ?? null)),
    },
  }
}

export async function updateDropoffLocationService(
  input: DropoffLocationUpdateInput,
): Promise<{ ok: true; location: DropoffLocationRow } | { ok: false; error: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  const db = createServiceRoleClient()
  const existing = await fetchDropoffLocationById(db, input.id)
  if (!existing) return { ok: false, error: "Dropoff location not found." }

  try {
    const location = await updateDropoffLocationRow(db, input.id, {
      name: input.name,
      address_line1: input.address_line1,
      address_line2: input.address_line2?.trim() ? input.address_line2.trim() : null,
      city: input.city,
      state: input.state,
      postal_code: input.postal_code,
      phone: input.phone?.trim() ? input.phone.trim() : null,
      hours_note: input.hours_note?.trim() ? input.hours_note.trim() : null,
      latitude: input.latitude ?? existing.latitude,
      longitude: input.longitude ?? existing.longitude,
      active: input.active,
      box_rules: input.box_rules,
    })
    return { ok: true, location }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update dropoff location."
    return { ok: false, error: message }
  }
}

export async function updateDropoffListingParcelService(
  input: DropoffListingParcelUpdateInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  const totalOz = parseReswellPackedWeightToTotalOz(String(input.weightLb), "0")
  if (totalOz == null) return { ok: false, error: "Enter a valid packed weight." }

  const db = createServiceRoleClient()
  try {
    await updateDropoffListingPackedParcel(db, input.listingId, {
      shipping_packed_length_in: input.lengthIn,
      shipping_packed_width_in: input.widthIn,
      shipping_packed_height_in: input.heightIn,
      shipping_packed_weight_oz: totalOz,
    })
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update box size."
    return { ok: false, error: message }
  }
}

function mapAdminListing(
  row: DropoffLocationListingRow,
  location: DropoffLocationRow | null,
): DropoffAdminListing {
  const parsedDims = parseListingDimensionsColumn(row.dimensions)
  const dims = {
    boardLength: parsedDims?.boardLength ?? "",
    boardWidthInches: parsedDims?.boardWidthInches ?? "",
  }
  const suggested = location ? matchDropoffBoxRule(location.box_rules, dims) : null
  const packed = reswellPackageFormFromDbRow(row)
  const boardDimensions =
    formatListingDimensionsLine({ dimensions: row.dimensions }) ??
    ([dims.boardLength, dims.boardWidthInches].filter(Boolean).join(" × ") || "—")

  return {
    id: row.id,
    title: row.title?.trim() || "Untitled listing",
    status: row.status?.trim() || "unknown",
    href: listingDetailHref({ id: row.id, slug: row.slug, section: "surfboards" }),
    editHref: withAdminListingEditEntry(`/sell/boards?edit=${row.id}`),
    thumbnailUrl: listingTitleThumbnailSrc(row.listing_images),
    sellerCity: [row.city, row.state].filter(Boolean).join(", ") || null,
    boardDimensions,
    suggestedBox: suggested
      ? `${suggested.rule.boxLengthIn}×${suggested.rule.boxWidthIn}×${suggested.rule.boxHeightIn}`
      : null,
    packedLengthIn: packed.reswellPackageLengthIn,
    packedWidthIn: packed.reswellPackageWidthIn,
    packedHeightIn: packed.reswellPackageHeightIn,
    packedWeightLb: packed.reswellPackageWeightLb,
    packedWeightOz: packed.reswellPackageWeightOz,
    currentBox: formatDropoffPackedParcel(row),
    locationId: row.dropoff_location_id,
    locationName: location?.name ?? "Dropoff",
  }
}

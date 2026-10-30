import type { MobileSellDraft } from "@reswell/api-contract"
import { MOBILE_LISTING_CATEGORIES, MOBILE_SELL_MAX_PHOTOS } from "@reswell/api-contract"
import type { OwnedListingForEditRow } from "@/lib/db/listingEdit"
import { surfboardSellFormDimensionsFromListingRow } from "@/lib/listing-dimensions-storage"
import { reswellPackageFormFromDbRow } from "@/lib/sell-listing-fulfillment-flags"
import {
  parseSurfboardShippingPackBandId,
  surfboardShippingPackBandFixedParcel,
} from "@/lib/surfboard-shipping-pack-bands"
import { boardTypeFromCategoryId } from "@/lib/utils/board-type-from-category-id"

const CATEGORY_SET = new Set<string>(MOBILE_LISTING_CATEGORIES)

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function sellCondition(value: unknown): MobileSellDraft["condition"] {
  const normalized = text(value)
  if (
    normalized === "brand_new" ||
    normalized === "excellent" ||
    normalized === "very_good" ||
    normalized === "good" ||
    normalized === "fair" ||
    normalized === "poor"
  ) {
    return normalized
  }
  return "good"
}

function shippingState(row: OwnedListingForEditRow): Pick<
  MobileSellDraft,
  "local_pickup" | "shipping" | "shipping_mode" | "shipping_price"
> {
  const pickup = row.local_pickup === true
  const ships = row.shipping_available === true
  const mode = text(row.board_shipping_cost_mode)
  if (!ships && pickup) {
    return { local_pickup: true, shipping: false, shipping_mode: "reswell", shipping_price: null }
  }
  if (mode === "free") {
    return { local_pickup: pickup, shipping: true, shipping_mode: "free", shipping_price: 0 }
  }
  if (mode === "flat") {
    const price = numberOrNull(row.shipping_price)
    return {
      local_pickup: pickup,
      shipping: true,
      shipping_mode: "flat",
      shipping_price: price != null && price >= 0 ? price : 0,
    }
  }
  return { local_pickup: pickup, shipping: ships || !pickup, shipping_mode: "reswell", shipping_price: null }
}

type EditImage = MobileSellDraft["images"][number] & { image_id?: string }
type EditVideo = NonNullable<MobileSellDraft["videos"]>[number]

function listingImages(row: OwnedListingForEditRow): EditImage[] {
  const rows = [...(row.listing_images ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .slice(0, MOBILE_SELL_MAX_PHOTOS)
  return rows.flatMap((image) => {
    const url = text(image.url)
    if (!url) return []
    const thumbnail = text(image.thumbnail_url) || url
    return [{ url, thumbnail_url: thumbnail, image_id: image.id }]
  })
}

function listingVideos(row: OwnedListingForEditRow): EditVideo[] {
  const rows = [...(row.listing_videos ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return rows.flatMap((video) => {
    const url = text(video.url)
    if (!url) return []
    const thumb = text(video.thumbnail_url)
    return [
      {
        url,
        thumbnail_url: thumb || null,
        content_type: text(video.content_type) || null,
        duration_seconds: numberOrNull(video.duration_seconds),
        byte_size: (() => {
          const bytes = numberOrNull(video.byte_size)
          return bytes != null ? Math.round(bytes) : null
        })(),
        video_id: video.id,
      },
    ]
  })
}

/** Maps an owner listing row into the mobile sell-screen payload. */
export function ownedListingRowToMobileSellEdit(row: OwnedListingForEditRow):
  | { ok: true; draft: MobileSellDraft; listingId: string; status: string; slug: string | null; locationLabel: string | null }
  | { ok: false; error: string } {
  const section = text(row.section)
  if (!CATEGORY_SET.has(section)) {
    return { ok: false, error: "This listing type cannot be edited in the app yet" }
  }

  const surfboard = section === "surfboards"
  const subcategory = surfboard
    ? text(row.board_type) ||
      (row.category_id ? boardTypeFromCategoryId(String(row.category_id)) : "") ||
      "shortboard"
    : ""

  const dimensionRow = row as OwnedListingForEditRow & {
    dimensions?: string | null
    length_total_inches?: number | string | null
    volume_liters?: number | string | null
    fin_setup?: string | null
  }
  const dims = surfboard
    ? surfboardSellFormDimensionsFromListingRow({
        dimensions: dimensionRow.dimensions ?? null,
        length_total_inches: numberOrNull(dimensionRow.length_total_inches),
        volume_liters: numberOrNull(dimensionRow.volume_liters),
        title: row.title ?? null,
      })
    : null

  const packedFromRow = reswellPackageFormFromDbRow(row)
  const packBand =
    surfboard && !packedFromRow.reswellPackageLengthIn
      ? parseSurfboardShippingPackBandId(row.shipping_package_band)
      : null
  const packBandParcel = packBand ? surfboardShippingPackBandFixedParcel(packBand) : null
  const packed = packBandParcel
    ? {
        reswellPackageLengthIn: String(packBandParcel.lengthIn),
        reswellPackageWidthIn: String(packBandParcel.widthIn),
        reswellPackageHeightIn: String(packBandParcel.heightIn),
        reswellPackageWeightLb: String(packBandParcel.weightLb),
        reswellPackageWeightOz: "",
      }
    : packedFromRow
  const shipping = shippingState(row)

  const specs: MobileSellDraft["specs"] = {}
  if (dims) {
    if (dims.boardLength) specs.length = dims.boardLength
    if (dims.boardWidthInches) specs.width = dims.boardWidthInches
    if (dims.boardThicknessInches) specs.thickness = dims.boardThicknessInches
    if (dims.boardVolumeL) specs.volume = dims.boardVolumeL
  }
  const finSetup = text(row.fins_setup) || text(dimensionRow.fin_setup)
  if (finSetup) specs.fin_setup = finSetup
  const finSystem = text(row.fin_system)
  if (finSystem) specs.fin_system = finSystem
  const construction = text(row.construction)
  if (construction) specs.construction = construction
  if (row.fins_included === true) specs.fins_included = "included"
  if (row.fins_included === false) specs.fins_included = "not_included"

  const city = text(row.city)
  const state = text(row.state)
  const locationLabel = [city, state].filter(Boolean).join(", ")

  const price = numberOrNull(row.price)

  const draft: MobileSellDraft = {
    id: row.id,
    title: text(row.title),
    description: text(row.description),
    brand: text(row.brand),
    model: text(row.model),
    category: section as MobileSellDraft["category"],
    subcategory,
    condition: sellCondition(row.condition),
    price: price != null && price > 0 ? price : null,
    city,
    state,
    location_lat: numberOrNull(row.latitude),
    location_lng: numberOrNull(row.longitude),
    ...shipping,
    package_length: packed.reswellPackageLengthIn,
    package_width: packed.reswellPackageWidthIn,
    package_height: packed.reswellPackageHeightIn,
    package_weight_lb: packed.reswellPackageWeightLb,
    package_weight_oz: packed.reswellPackageWeightOz,
    dropoff_location_id: text(row.dropoff_location_id) || null,
    specs,
    images: listingImages(row),
    videos: listingVideos(row),
  }

  return {
    ok: true,
    draft,
    listingId: row.id,
    status: text(row.status) || "active",
    slug: row.slug?.trim() || null,
    locationLabel: locationLabel || null,
  }
}

import { CONSTRUCTION_OPTIONS, FIN_SYSTEM_OPTIONS } from "@/lib/boards-browse-facets"
import { APPAREL_KIND_OPTIONS, apparelKindSlugForDb } from "@/lib/apparel-listing-config"
import { finSizeSlugForDb, FIN_SIZE_OPTIONS } from "@/lib/fin-listing-config"
import {
  boardBrowseFacetFieldsForDb,
  finsIncludedFieldForDb,
  finsIncludedFormValue,
} from "@/lib/listing-facet-write"
import {
  FIN_SETUP_TAG_OPTIONS,
  serializeFinsSetupTags,
  singleFinSetupSlugForForm,
} from "@/lib/listing-fin-setup-tags"
import {
  listingDimensionsColumnFromSurfboardSellForm,
  surfboardSellFormDimensionsFromListingRow,
} from "@/lib/listing-dimensions-storage"
import {
  serializeTailShapeTags,
  singleTailShapeSlugForForm,
  TAIL_SHAPE_TAG_OPTIONS,
} from "@/lib/listing-tail-shape-tags"
import { listingAlwaysUsesReswellShipping } from "@/lib/apparel-listing-config"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { reswellPackageFieldsToDb, reswellPackageFormFromDbRow } from "@/lib/sell-listing-fulfillment-flags"
import { normalizeSellShippingCostMode, type SellShippingCostMode } from "@/lib/sell-shipping-cost-mode"
import { shippingPriceToFormValue } from "@/lib/sell-flow/shipping-price-to-form-value"
import {
  isShopPackageSizeId,
  listingPackageColumnsForShopSize,
  shopPackageSizesForSection,
  type ListingPackageColumns,
} from "@/lib/shop-category-package-sizes"
import {
  parseSurfboardShippingPackBandId,
  surfboardShippingPackBandFixedParcel,
} from "@/lib/surfboard-shipping-pack-bands"
import { tractionSizeSlugForDb, TRACTION_SIZE_OPTIONS } from "@/lib/traction-listing-config"
import { wetsuitSizeSlugForDb, WETSUIT_SIZE_OPTIONS } from "@/lib/wetsuit-listing-config"

export type ListingDeskSpec = {
  brand: string
  model: string
  city: string
  state: string
  latitude: number | null
  longitude: number | null
  locationDisplay: string
  localPickup: boolean
  shippingAvailable: boolean
  shippingCostMode: SellShippingCostMode
  shippingPrice: string
  dropoffLocationId: string
  packageLengthIn: string
  packageWidthIn: string
  packageHeightIn: string
  packageWeightLb: string
  packageWeightOz: string
  boardLength: string
  boardWidth: string
  boardThickness: string
  boardVolume: string
  finSetup: string
  finSystem: string
  construction: string
  finsIncluded: string
  tailShape: string
  finSize: string
  wetsuitSize: string
  apparelKind: string
  tractionSize: string
}

export type ListingDeskSource = {
  section: string
  title?: string | null
  brand?: string | null
  model?: string | null
  city?: string | null
  state?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  local_pickup?: boolean | null
  shipping_available?: boolean | null
  board_shipping_cost_mode?: string | null
  shipping_price?: number | string | null
  dropoff_location_id?: string | null
  shipping_package_tier?: string | null
  shipping_package_band?: string | null
  shipping_packed_length_in?: number | string | null
  shipping_packed_width_in?: number | string | null
  shipping_packed_height_in?: number | string | null
  shipping_packed_weight_oz?: number | string | null
  dimensions?: string | null
  length_total_inches?: number | null
  volume_liters?: number | null
  fins_setup?: string | null
  fin_system?: string | null
  construction?: string | null
  fins_included?: boolean | null
  tail_shape?: string | null
  fin_size?: string | null
  wetsuit_size?: string | null
  apparel_kind?: string | null
  traction_size?: string | null
}

export type ListingDeskColumns = {
  brand: string | null
  model: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  local_pickup: boolean
  shipping_available: boolean
  shipping_price: number | null
  board_shipping_cost_mode: "reswell" | "flat" | "free" | null
  dropoff_location_id: string | null
  dimensions?: string | null
  length_total_inches?: number | null
  volume_liters?: number | null
  fins_setup?: string | null
  fin_system?: string | null
  construction?: string | null
  fins_included?: boolean | null
  tail_shape?: string | null
  fin_size?: string | null
  wetsuit_size?: string | null
  apparel_kind?: string | null
  traction_size?: string | null
} & Partial<ListingPackageColumns>

type ListingDeskTextKey = {
  [Key in keyof ListingDeskSpec]: ListingDeskSpec[Key] extends string ? Key : never
}[keyof ListingDeskSpec]

export type ListingDeskFacet = {
  key: ListingDeskTextKey
  label: string
  options: readonly { value: string; label: string }[]
}

const FIN_SYSTEM_SLUGS = new Set(FIN_SYSTEM_OPTIONS.map((option) => option.value))
const CONSTRUCTION_SLUGS = new Set(CONSTRUCTION_OPTIONS.map((option) => option.value))

function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : ""
}

function knownSlug(value: string | null | undefined, allowed: Set<string>): string {
  const slug = text(value).toLowerCase()
  return allowed.has(slug) ? slug : ""
}

const SHIP_ONLY_SECTIONS = new Set(["fins", "wetsuits", "magazines"])
const DROPOFF_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function coordinate(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n === 0) return null
  return n
}

function packageFormFromSource(row: ListingDeskSource): {
  packageLengthIn: string
  packageWidthIn: string
  packageHeightIn: string
  packageWeightLb: string
  packageWeightOz: string
} {
  const loaded = reswellPackageFormFromDbRow(row)
  const hasBox = [loaded.reswellPackageLengthIn, loaded.reswellPackageWidthIn, loaded.reswellPackageHeightIn].some(
    (value) => value.trim(),
  )
  if (hasBox) {
    return {
      packageLengthIn: loaded.reswellPackageLengthIn,
      packageWidthIn: loaded.reswellPackageWidthIn,
      packageHeightIn: loaded.reswellPackageHeightIn,
      packageWeightLb: loaded.reswellPackageWeightLb,
      packageWeightOz: loaded.reswellPackageWeightOz,
    }
  }
  const band = row.section === "surfboards" ? parseSurfboardShippingPackBandId(row.shipping_package_band) : null
  if (!band) {
    return {
      packageLengthIn: "",
      packageWidthIn: "",
      packageHeightIn: "",
      packageWeightLb: "",
      packageWeightOz: "",
    }
  }
  const parcel = surfboardShippingPackBandFixedParcel(band)
  return {
    packageLengthIn: String(parcel.lengthIn),
    packageWidthIn: String(parcel.widthIn),
    packageHeightIn: String(parcel.heightIn),
    packageWeightLb: String(parcel.weightLb),
    packageWeightOz: "",
  }
}

function fulfillmentFromSpec(
  section: string,
  spec: ListingDeskSpec,
): { local_pickup: boolean; shipping_available: boolean; mode: SellShippingCostMode | null } {
  if (section === "magazines") {
    return { local_pickup: false, shipping_available: true, mode: "reswell" }
  }
  if (SHIP_ONLY_SECTIONS.has(section)) {
    return { local_pickup: false, shipping_available: true, mode: spec.shippingCostMode }
  }
  let shipping = spec.shippingAvailable
  let pickup = spec.localPickup
  if (!shipping && !pickup) shipping = true
  if (listingAlwaysUsesReswellShipping(section)) {
    return { local_pickup: pickup, shipping_available: shipping, mode: shipping ? "reswell" : null }
  }
  return {
    local_pickup: pickup,
    shipping_available: shipping,
    mode: shipping ? spec.shippingCostMode : null,
  }
}

function shippingPriceColumn(mode: SellShippingCostMode | null, raw: string): number | null {
  if (!mode) return null
  if (mode !== "flat") return 0
  const trimmed = raw.trim().replace(/,/g, "")
  if (!trimmed) return 0
  const price = Number.parseFloat(trimmed)
  return Number.isFinite(price) ? price : null
}

function cartonIsEmpty(spec: ListingDeskSpec): boolean {
  return [
    spec.packageLengthIn,
    spec.packageWidthIn,
    spec.packageHeightIn,
    spec.packageWeightLb,
    spec.packageWeightOz,
  ].every((value) => !value.trim())
}

function packedColumnsForSpec(
  section: string,
  spec: ListingDeskSpec,
  mode: SellShippingCostMode | null,
): ListingPackageColumns | null {
  if (mode !== "reswell") return null
  if (cartonIsEmpty(spec)) {
    return {
      shipping_packed_length_in: null,
      shipping_packed_width_in: null,
      shipping_packed_height_in: null,
      shipping_packed_weight_oz: null,
      shipping_package_tier: null,
      shipping_package_band: null,
    }
  }
  const entered = reswellPackageFieldsToDb({
    boardShippingCostMode: "reswell",
    adminCustomShippingCarton: true,
    reswellPackageLengthIn: spec.packageLengthIn,
    reswellPackageWidthIn: spec.packageWidthIn,
    reswellPackageHeightIn: spec.packageHeightIn,
    reswellPackageWeightLb: spec.packageWeightLb,
    reswellPackageWeightOz: spec.packageWeightOz,
  })
  const complete =
    entered.shipping_packed_length_in != null &&
    entered.shipping_packed_width_in != null &&
    entered.shipping_packed_height_in != null &&
    entered.shipping_packed_weight_oz != null
  if (!complete) return null
  const matched = listingDeskInferredPackageSizeId(section, spec)
  if (isPeerListingSection(section) && isShopPackageSizeId(matched)) {
    return listingPackageColumnsForShopSize(section, matched) ?? entered
  }
  if (section !== "surfboards") {
    return {
      ...entered,
      shipping_package_tier: null,
      shipping_package_band: null,
    }
  }
  return entered
}

/** Carton strings for a shop preset, so the shipping card matches a one-tap size. */
export function listingDeskCartonFromSize(
  section: string,
  sizeId: string,
): Pick<
  ListingDeskSpec,
  "packageLengthIn" | "packageWidthIn" | "packageHeightIn" | "packageWeightLb" | "packageWeightOz"
> | null {
  if (!isPeerListingSection(section) || !isShopPackageSizeId(sizeId)) return null
  const columns = listingPackageColumnsForShopSize(section, sizeId)
  if (!columns) return null
  const form = reswellPackageFormFromDbRow(columns)
  return {
    packageLengthIn: form.reswellPackageLengthIn,
    packageWidthIn: form.reswellPackageWidthIn,
    packageHeightIn: form.reswellPackageHeightIn,
    packageWeightLb: form.reswellPackageWeightLb,
    packageWeightOz: form.reswellPackageWeightOz,
  }
}

/** Shop preset that matches the carton on screen, `custom` when it doesn't, or blank when empty. */
export function listingDeskInferredPackageSizeId(section: string, spec: ListingDeskSpec): string {
  if (!isPeerListingSection(section)) return ""
  for (const sizeId of shopPackageSizesForSection(section)) {
    const carton = listingDeskCartonFromSize(section, sizeId)
    if (!carton) continue
    const same = (Object.keys(carton) as (keyof typeof carton)[]).every(
      (key) => carton[key].trim() === spec[key].trim(),
    )
    if (same) return sizeId
  }
  return cartonIsEmpty(spec) ? "" : "custom"
}

export function listingDeskSpecFromRow(row: ListingDeskSource): ListingDeskSpec {
  const dims =
    row.section === "surfboards"
      ? surfboardSellFormDimensionsFromListingRow(row)
      : { boardLength: "", boardWidthInches: "", boardThicknessInches: "", boardVolumeL: "" }
  const city = text(row.city)
  const state = text(row.state)
  const box = packageFormFromSource(row)
  const dropoff = text(row.dropoff_location_id)
  return {
    brand: text(row.brand),
    model: text(row.model),
    city,
    state,
    latitude: coordinate(row.latitude),
    longitude: coordinate(row.longitude),
    locationDisplay: [city, state].filter(Boolean).join(", "),
    localPickup: row.local_pickup !== false,
    shippingAvailable: row.shipping_available === true,
    shippingCostMode: normalizeSellShippingCostMode(
      row.board_shipping_cost_mode === "flat" ||
        row.board_shipping_cost_mode === "free" ||
        row.board_shipping_cost_mode === "reswell"
        ? row.board_shipping_cost_mode
        : null,
    ),
    shippingPrice: shippingPriceToFormValue(row.shipping_price),
    dropoffLocationId: DROPOFF_ID.test(dropoff) ? dropoff : "",
    ...box,
    boardLength: dims.boardLength,
    boardWidth: dims.boardWidthInches,
    boardThickness: dims.boardThicknessInches,
    boardVolume: dims.boardVolumeL,
    finSetup:
      row.section === "surfboards" || row.section === "fins"
        ? singleFinSetupSlugForForm(row.fins_setup)
        : "",
    finSystem: knownSlug(row.fin_system, FIN_SYSTEM_SLUGS),
    construction: knownSlug(row.construction, CONSTRUCTION_SLUGS),
    finsIncluded: row.section === "surfboards" ? finsIncludedFormValue(row.fins_included) : "",
    tailShape: row.section === "surfboards" ? singleTailShapeSlugForForm(row.tail_shape) : "",
    finSize: row.section === "fins" ? finSizeSlugForDb(row.fin_size) ?? "" : "",
    wetsuitSize: row.section === "wetsuits" ? wetsuitSizeSlugForDb(row.wetsuit_size) ?? "" : "",
    apparelKind: row.section === "apparel" ? apparelKindSlugForDb(row.apparel_kind) ?? "" : "",
    tractionSize: row.section === "traction" ? tractionSizeSlugForDb(row.traction_size) ?? "" : "",
  }
}

export function listingDeskSpecsEqual(a: ListingDeskSpec, b: ListingDeskSpec): boolean {
  return (Object.keys(a) as (keyof ListingDeskSpec)[]).every((key) => a[key] === b[key])
}

export function listingDeskFacets(section: string): ListingDeskFacet[] {
  if (section === "surfboards") {
    return [
      { key: "finSetup", label: "Fin setup", options: FIN_SETUP_TAG_OPTIONS },
      { key: "finSystem", label: "Fin system", options: FIN_SYSTEM_OPTIONS },
      { key: "finsIncluded", label: "Fins included", options: [
        { value: "included", label: "Included" },
        { value: "not_included", label: "Not included" },
      ] },
      { key: "construction", label: "Construction", options: CONSTRUCTION_OPTIONS },
      { key: "tailShape", label: "Tail", options: TAIL_SHAPE_TAG_OPTIONS },
    ]
  }
  if (section === "fins") {
    return [
      { key: "finSetup", label: "Fin setup", options: FIN_SETUP_TAG_OPTIONS },
      { key: "finSystem", label: "Fin system", options: FIN_SYSTEM_OPTIONS },
      { key: "finSize", label: "Size", options: FIN_SIZE_OPTIONS },
    ]
  }
  if (section === "wetsuits") {
    return [{ key: "wetsuitSize", label: "Size", options: WETSUIT_SIZE_OPTIONS }]
  }
  if (section === "apparel") {
    return [{ key: "apparelKind", label: "Type", options: APPAREL_KIND_OPTIONS }]
  }
  if (section === "traction") {
    return [{ key: "tractionSize", label: "Type", options: TRACTION_SIZE_OPTIONS }]
  }
  return []
}

function blank(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function listingDeskColumnsFromSpec(
  section: string,
  spec: ListingDeskSpec,
): { columns: ListingDeskColumns } | { error: string } {
  const delivery = fulfillmentFromSpec(section, spec)
  if (delivery.mode === "flat" && spec.shippingPrice.trim()) {
    const price = Number.parseFloat(spec.shippingPrice.trim().replace(/,/g, ""))
    if (!Number.isFinite(price) || price < 0) {
      return { error: "Enter a shipping price of $0 or more." }
    }
  }
  const dropoff =
    section === "surfboards" && delivery.mode === "reswell" && DROPOFF_ID.test(spec.dropoffLocationId.trim())
      ? spec.dropoffLocationId.trim()
      : null
  const columns: ListingDeskColumns = {
    brand: blank(spec.brand),
    model: blank(spec.model),
    city: blank(spec.city),
    state: blank(spec.state),
    latitude: coordinate(spec.latitude),
    longitude: coordinate(spec.longitude),
    local_pickup: delivery.local_pickup,
    shipping_available: delivery.shipping_available,
    shipping_price: shippingPriceColumn(delivery.mode, spec.shippingPrice),
    board_shipping_cost_mode: delivery.mode,
    dropoff_location_id: dropoff,
  }
  const packed = packedColumnsForSpec(section, spec, delivery.mode)
  if (packed) Object.assign(columns, packed)

  if (section === "surfboards") {
    const dimensionInput = {
      boardLength: spec.boardLength,
      boardWidthInches: spec.boardWidth,
      boardThicknessInches: spec.boardThickness,
      boardVolumeL: spec.boardVolume,
    }
    const anyDimension = Object.values(dimensionInput).some((value) => value.trim())
    const dimensions = listingDimensionsColumnFromSurfboardSellForm(dimensionInput)
    if (anyDimension && !dimensions) {
      return {
        error: "Check the board size. Length looks like 6'1, width and thickness are inches, volume is liters.",
      }
    }
    const facets = boardBrowseFacetFieldsForDb({
      boardLength: spec.boardLength,
      boardVolumeL: spec.boardVolume,
      boardFins: spec.finSetup,
      boardFinSystem: spec.finSystem,
      boardConstruction: spec.construction,
      boardFinsIncluded: spec.finsIncluded,
    })
    columns.dimensions = dimensions
    columns.length_total_inches = facets.length_total_inches
    columns.volume_liters = facets.volume_liters
    columns.fins_setup = serializeFinsSetupTags(spec.finSetup ? [spec.finSetup] : [])
    columns.fin_system = facets.fin_system
    columns.construction = facets.construction
    columns.fins_included = facets.fins_included
    columns.tail_shape = serializeTailShapeTags(spec.tailShape ? [spec.tailShape] : [])
  } else if (section === "fins") {
    const finSize = spec.finSize.trim() ? finSizeSlugForDb(spec.finSize) : null
    if (spec.finSize.trim() && !finSize) return { error: "Pick a fin size." }
    columns.fins_setup = serializeFinsSetupTags(spec.finSetup ? [spec.finSetup] : [])
    columns.fin_system = spec.finSystem.trim()
      ? FIN_SYSTEM_SLUGS.has(spec.finSystem.trim().toLowerCase())
        ? spec.finSystem.trim().toLowerCase()
        : null
      : null
    if (spec.finSystem.trim() && !columns.fin_system) return { error: "Pick a fin system." }
    columns.fin_size = finSize
  } else if (section === "wetsuits") {
    const size = spec.wetsuitSize.trim() ? wetsuitSizeSlugForDb(spec.wetsuitSize) : null
    if (spec.wetsuitSize.trim() && !size) return { error: "Pick a wetsuit size." }
    columns.wetsuit_size = size
  } else if (section === "apparel") {
    const kind = spec.apparelKind.trim() ? apparelKindSlugForDb(spec.apparelKind) : null
    if (spec.apparelKind.trim() && !kind) return { error: "Pick an apparel type." }
    columns.apparel_kind = kind
  } else if (section === "traction") {
    const size = spec.tractionSize.trim() ? tractionSizeSlugForDb(spec.tractionSize) : null
    if (spec.tractionSize.trim() && !size) return { error: "Pick a traction type." }
    columns.traction_size = size
  }

  if (section === "surfboards" && spec.finsIncluded.trim()) {
    const included = finsIncludedFieldForDb(spec.finsIncluded)
    if (included == null) return { error: "Pick whether fins are included." }
  }

  return { columns }
}

/** Columns to copy back onto the desk row after a save. */
export function listingDeskStoredColumns(row: ListingDeskSource): ListingDeskColumns {
  const built = listingDeskColumnsFromSpec(row.section, listingDeskSpecFromRow(row))
  if ("columns" in built) return built.columns
  return {
    brand: blank(text(row.brand)),
    model: blank(text(row.model)),
    city: blank(text(row.city)),
    state: blank(text(row.state)),
    latitude: coordinate(row.latitude),
    longitude: coordinate(row.longitude),
    local_pickup: row.local_pickup === true,
    shipping_available: row.shipping_available === true,
    shipping_price: shippingPriceColumn(
      row.shipping_available === true
        ? normalizeSellShippingCostMode(
            row.board_shipping_cost_mode === "flat" ||
              row.board_shipping_cost_mode === "free" ||
              row.board_shipping_cost_mode === "reswell"
              ? row.board_shipping_cost_mode
              : null,
          )
        : null,
      shippingPriceToFormValue(row.shipping_price),
    ),
    board_shipping_cost_mode:
      row.shipping_available === true
        ? normalizeSellShippingCostMode(
            row.board_shipping_cost_mode === "flat" ||
              row.board_shipping_cost_mode === "free" ||
              row.board_shipping_cost_mode === "reswell"
              ? row.board_shipping_cost_mode
              : null,
          )
        : null,
    dropoff_location_id: DROPOFF_ID.test(text(row.dropoff_location_id)) ? text(row.dropoff_location_id) : null,
  }
}

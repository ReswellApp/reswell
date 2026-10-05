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
import { tractionSizeSlugForDb, TRACTION_SIZE_OPTIONS } from "@/lib/traction-listing-config"
import { wetsuitSizeSlugForDb, WETSUIT_SIZE_OPTIONS } from "@/lib/wetsuit-listing-config"

export type ListingDeskSpec = {
  brand: string
  model: string
  city: string
  state: string
  localPickup: boolean
  shippingAvailable: boolean
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
  local_pickup?: boolean | null
  shipping_available?: boolean | null
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
  local_pickup: boolean
  shipping_available: boolean
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

export function listingDeskSpecFromRow(row: ListingDeskSource): ListingDeskSpec {
  const dims =
    row.section === "surfboards"
      ? surfboardSellFormDimensionsFromListingRow(row)
      : { boardLength: "", boardWidthInches: "", boardThicknessInches: "", boardVolumeL: "" }
  return {
    brand: text(row.brand),
    model: text(row.model),
    city: text(row.city),
    state: text(row.state),
    localPickup: row.local_pickup === true,
    shippingAvailable: row.shipping_available === true,
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
  const columns: ListingDeskColumns = {
    brand: blank(spec.brand),
    model: blank(spec.model),
    city: blank(spec.city),
    state: blank(spec.state),
    local_pickup: spec.localPickup,
    shipping_available: spec.shippingAvailable,
  }

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
    local_pickup: row.local_pickup === true,
    shipping_available: row.shipping_available === true,
  }
}

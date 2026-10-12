/**
 * Shop-level shipping default: one store box, plus board-length assignments
 * to saved packed sizes. Canonical storage is inches and pounds.
 */

import { totalBoardLengthInchesFromCombinedInput } from "@/lib/board-measurements"
import { parseListingDimensionsColumn } from "@/lib/listing-dimensions-storage"
import { isPeerListingSection, type PeerListingSection } from "@/lib/peer-listing-sections"
import {
  isShopPackageSizeAllowed,
  isShopPackageSizeId,
  listingPackageColumnsForShopSize,
  shopPackageSizeLabel,
  type ListingPackageColumns,
  type ShopCategoryPackageSizeMap,
  type ShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"
import {
  SHORTBOARD_PACK_BAND_LENGTH_PAD_IN,
  SURFBOARD_SHIPPING_PACK_BANDS,
} from "@/lib/surfboard-shipping-pack-bands"
import {
  RESWELL_MAX_REASONABLE_SMALL_PARCEL_HEIGHT_IN,
  RESWELL_MAX_REASONABLE_SMALL_PARCEL_LENGTH_IN,
  RESWELL_MAX_REASONABLE_SMALL_PARCEL_WIDTH_IN,
  RESWELL_MAX_REASONABLE_STORED_PARCEL_HEIGHT_IN,
  RESWELL_MAX_REASONABLE_STORED_PARCEL_LENGTH_IN,
  RESWELL_MAX_REASONABLE_STORED_PARCEL_WEIGHT_OZ,
  RESWELL_MAX_REASONABLE_STORED_PARCEL_WIDTH_IN,
  RESWELL_MIN_REASONABLE_SMALL_PARCEL_HEIGHT_IN,
  RESWELL_MIN_REASONABLE_SMALL_PARCEL_LENGTH_IN,
  RESWELL_MIN_REASONABLE_SMALL_PARCEL_WIDTH_IN,
  RESWELL_MIN_REASONABLE_STORED_PARCEL_HEIGHT_IN,
  RESWELL_MIN_REASONABLE_STORED_PARCEL_LENGTH_IN,
  RESWELL_MIN_REASONABLE_STORED_PARCEL_WEIGHT_OZ,
  RESWELL_MIN_REASONABLE_STORED_PARCEL_WIDTH_IN,
} from "@/lib/surfboard-shipping-estimates"
import {
  SURFBOARD_TIER_LONGBOARD_MAX_BOARD_LENGTH_IN,
  SURFBOARD_TIER_MIDLENGTH_MAX_BOARD_LENGTH_IN,
  SURFBOARD_TIER_SHORTBOARD_MAX_BOARD_LENGTH_IN,
  formatSurfboardTierBoardLengthLabel,
  resolveSurfboardShippingTierFromBoardLengthIn,
  surfboardShippingTierBoardBandDescription,
} from "@/lib/surfboard-shipping-tiers"

export const SHOP_STORE_DEFAULT_ID = "store_default"
export const SHOP_STORE_DEFAULT_PACKAGE_NAME = "Shop box"
export const SHOP_SAVED_PACKAGE_LIMIT = 12

export const SHOP_BOARD_PACK_SIZE_IDS = [
  "shortboard_compact",
  "shortboard_medium",
  "midlength",
  "longboard",
] as const

export type ShopBoardPackSizeId = (typeof SHOP_BOARD_PACK_SIZE_IDS)[number]
export type ShopDimensionUnit = "in" | "cm"
export type ShopWeightUnit = "lb" | "oz" | "kg"

const BOARD_PACK_SIZE_SET = new Set<string>(SHOP_BOARD_PACK_SIZE_IDS)
const SAVED_PACKAGE_ID = /^box_[a-z0-9]{8,16}$/
const MEASURE_INPUT = /^\d+(\.\d+)?$/
const LB_PER_KG = 2.2046226218
const CM_PER_IN = 2.54

export type ShopSavedPackedSize = {
  id: string
  name: string
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
  presetId: ShopPackageSizeId | null
}

export type ShopShippingDefaults = {
  physicalProduct: boolean
  dimensionUnit: ShopDimensionUnit
  weightUnit: ShopWeightUnit
  storeDefault: ShopSavedPackedSize | null
  savedPackages: ShopSavedPackedSize[]
  boardSizes: Partial<Record<ShopBoardPackSizeId, string>>
}

export const EMPTY_SHOP_SHIPPING_DEFAULTS: ShopShippingDefaults = {
  physicalProduct: true,
  dimensionUnit: "in",
  weightUnit: "lb",
  storeDefault: null,
  savedPackages: [],
  boardSizes: {},
}

export type ShopShippingDraftPackage = {
  id: string
  name: string
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
  presetId: string | null
}

export type ShopShippingDraftInput = {
  physicalProduct: boolean
  dimensionUnit: ShopDimensionUnit
  weightUnit: ShopWeightUnit
  name: string
  presetId: string | null
  length: string
  width: string
  height: string
  weight: string
  savedPackages: ShopShippingDraftPackage[]
  boardSizes: { [key: string]: string | undefined }
}

export type ShopShippingListingTarget = {
  id: string
  section: string
  lengthTotalInches: number | null
  columns: ListingPackageColumns
}

export type ShopShippingApplyPlan = {
  updates: { id: string; columns: ListingPackageColumns }[]
  skippedBecausePackageDoesNotFit: number
}

export function isShopBoardPackSizeId(value: string): value is ShopBoardPackSizeId {
  return BOARD_PACK_SIZE_SET.has(value)
}

export function isShopDimensionUnit(value: string): value is ShopDimensionUnit {
  return value === "in" || value === "cm"
}

export function isShopWeightUnit(value: string): value is ShopWeightUnit {
  return value === "lb" || value === "oz" || value === "kg"
}

export function createShopSavedPackageId(): string {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 10)
  return `box_${token}`
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

export function formatShopMeasure(value: number): string {
  if (!Number.isFinite(value)) return "0"
  return String(round2(value))
}

export function lengthToInches(value: number, unit: ShopDimensionUnit): number {
  return unit === "cm" ? value / CM_PER_IN : value
}

export function lengthFromInches(inches: number, unit: ShopDimensionUnit): number {
  return unit === "cm" ? inches * CM_PER_IN : inches
}

export function weightToLb(value: number, unit: ShopWeightUnit): number {
  if (unit === "oz") return value / 16
  if (unit === "kg") return value * LB_PER_KG
  return value
}

export function weightFromLb(pounds: number, unit: ShopWeightUnit): number {
  if (unit === "oz") return pounds * 16
  if (unit === "kg") return pounds / LB_PER_KG
  return pounds
}

export function formatShopPackedSizeSummary(
  pkg: Pick<ShopSavedPackedSize, "lengthIn" | "widthIn" | "heightIn" | "weightLb">,
  units?: { dimensionUnit?: ShopDimensionUnit; weightUnit?: ShopWeightUnit },
): string {
  const dimensionUnit = units?.dimensionUnit ?? "in"
  const weightUnit = units?.weightUnit ?? "lb"
  const length = formatShopMeasure(lengthFromInches(pkg.lengthIn, dimensionUnit))
  const width = formatShopMeasure(lengthFromInches(pkg.widthIn, dimensionUnit))
  const height = formatShopMeasure(lengthFromInches(pkg.heightIn, dimensionUnit))
  const weight = formatShopMeasure(weightFromLb(pkg.weightLb, weightUnit))
  return `${length} × ${width} × ${height} ${dimensionUnit}, ${weight} ${weightUnit}`
}

export function formatStoreDefaultPackageLabel(
  name: string,
  summary: string | null,
): string {
  const title = name.trim() || SHOP_STORE_DEFAULT_PACKAGE_NAME
  if (!summary) return `Store default • ${title}`
  return `Store default • ${title} - ${summary}`
}

export function shopPresetPackedSize(sizeId: ShopPackageSizeId): ShopSavedPackedSize | null {
  const section: PeerListingSection =
    sizeId === "small" || sizeId === "medium" || sizeId === "large" ? "accessories" : "surfboards"
  const columns = listingPackageColumnsForShopSize(section, sizeId)
  if (
    columns?.shipping_packed_length_in == null ||
    columns.shipping_packed_width_in == null ||
    columns.shipping_packed_height_in == null ||
    columns.shipping_packed_weight_oz == null
  ) {
    return null
  }
  return {
    id: sizeId,
    name: shopPackageSizeLabel(sizeId),
    lengthIn: columns.shipping_packed_length_in,
    widthIn: columns.shipping_packed_width_in,
    heightIn: columns.shipping_packed_height_in,
    weightLb: round2(columns.shipping_packed_weight_oz / 16),
    presetId: sizeId,
  }
}

export function shopPresetPackedSizes(): ShopSavedPackedSize[] {
  const sizes: ShopSavedPackedSize[] = []
  for (const sizeId of [
    "shortboard_compact",
    "shortboard_medium",
    "midlength",
    "longboard",
    "small",
    "medium",
    "large",
  ] as const) {
    const preset = shopPresetPackedSize(sizeId)
    if (preset) sizes.push(preset)
  }
  return sizes
}

function storeDefaultFromPreset(sizeId: ShopPackageSizeId): ShopSavedPackedSize | null {
  const preset = shopPresetPackedSize(sizeId)
  if (!preset) return null
  return { ...preset, id: SHOP_STORE_DEFAULT_ID }
}

export function shopBoardPackSizeHint(sizeId: ShopBoardPackSizeId): string {
  if (sizeId === "shortboard_compact") {
    return `Up to about ${formatSurfboardTierBoardLengthLabel(
      SURFBOARD_SHIPPING_PACK_BANDS.shortboard_compact.maxBoardLengthIn,
    )}`
  }
  if (sizeId === "shortboard_medium") {
    const min = formatSurfboardTierBoardLengthLabel(
      SURFBOARD_SHIPPING_PACK_BANDS.shortboard_compact.maxBoardLengthIn + 1,
    )
    const max = formatSurfboardTierBoardLengthLabel(SURFBOARD_TIER_SHORTBOARD_MAX_BOARD_LENGTH_IN - 1)
    return `About ${min}–${max}`
  }
  return surfboardShippingTierBoardBandDescription(sizeId)
}

export function shopBoardPackSizes(): { id: ShopBoardPackSizeId; label: string; hint: string }[] {
  return SHOP_BOARD_PACK_SIZE_IDS.map((id) => ({
    id,
    label: shopPackageSizeLabel(id),
    hint: shopBoardPackSizeHint(id),
  }))
}

/** Longest bare board this band is meant to cover. */
export function shopBoardPackSizeMaxLengthIn(sizeId: ShopBoardPackSizeId): number {
  if (sizeId === "shortboard_compact") return SURFBOARD_SHIPPING_PACK_BANDS.shortboard_compact.maxBoardLengthIn
  if (sizeId === "shortboard_medium") return SURFBOARD_TIER_SHORTBOARD_MAX_BOARD_LENGTH_IN - 1
  if (sizeId === "midlength") return SURFBOARD_TIER_MIDLENGTH_MAX_BOARD_LENGTH_IN - 1
  return SURFBOARD_TIER_LONGBOARD_MAX_BOARD_LENGTH_IN - 1
}

export function shopBoardPackSizeForLength(
  lengthIn: number | null | undefined,
): ShopBoardPackSizeId | null {
  if (lengthIn == null || !Number.isFinite(lengthIn) || lengthIn <= 0) return null
  const tier = resolveSurfboardShippingTierFromBoardLengthIn(lengthIn)
  if (tier === "midlength" || tier === "longboard") return tier
  const packedNeed = lengthIn + SHORTBOARD_PACK_BAND_LENGTH_PAD_IN
  if (packedNeed <= SURFBOARD_SHIPPING_PACK_BANDS.shortboard_compact.lengthIn) {
    return "shortboard_compact"
  }
  return "shortboard_medium"
}

export function resolveListingBoardLengthInches(row: {
  length_total_inches?: unknown
  dimensions?: string | null
}): number | null {
  const direct = row.length_total_inches
  const numeric = typeof direct === "number" ? direct : typeof direct === "string" ? Number(direct) : NaN
  if (Number.isFinite(numeric) && numeric > 0) return numeric
  const parsed = row.dimensions?.trim() ? parseListingDimensionsColumn(row.dimensions) : null
  if (!parsed?.boardLength.trim()) return null
  const fromText = totalBoardLengthInchesFromCombinedInput(parsed.boardLength)
  return fromText != null && fromText > 0 ? fromText : null
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

export function packageFitsSurfboardListing(columns: ListingPackageColumns): boolean {
  const length = columns.shipping_packed_length_in
  const width = columns.shipping_packed_width_in
  const height = columns.shipping_packed_height_in
  const weightOz = columns.shipping_packed_weight_oz
  if (length == null || width == null || height == null || weightOz == null) return false
  return (
    inRange(length, RESWELL_MIN_REASONABLE_STORED_PARCEL_LENGTH_IN, RESWELL_MAX_REASONABLE_STORED_PARCEL_LENGTH_IN) &&
    inRange(width, RESWELL_MIN_REASONABLE_STORED_PARCEL_WIDTH_IN, RESWELL_MAX_REASONABLE_STORED_PARCEL_WIDTH_IN) &&
    inRange(height, RESWELL_MIN_REASONABLE_STORED_PARCEL_HEIGHT_IN, RESWELL_MAX_REASONABLE_STORED_PARCEL_HEIGHT_IN) &&
    inRange(weightOz, RESWELL_MIN_REASONABLE_STORED_PARCEL_WEIGHT_OZ, RESWELL_MAX_REASONABLE_STORED_PARCEL_WEIGHT_OZ)
  )
}

export function packageFitsSmallParcel(columns: ListingPackageColumns): boolean {
  const length = columns.shipping_packed_length_in
  const width = columns.shipping_packed_width_in
  const height = columns.shipping_packed_height_in
  const weightOz = columns.shipping_packed_weight_oz
  if (length == null || width == null || height == null || weightOz == null) return false
  return (
    inRange(length, RESWELL_MIN_REASONABLE_SMALL_PARCEL_LENGTH_IN, RESWELL_MAX_REASONABLE_SMALL_PARCEL_LENGTH_IN) &&
    inRange(width, RESWELL_MIN_REASONABLE_SMALL_PARCEL_WIDTH_IN, RESWELL_MAX_REASONABLE_SMALL_PARCEL_WIDTH_IN) &&
    inRange(height, RESWELL_MIN_REASONABLE_SMALL_PARCEL_HEIGHT_IN, RESWELL_MAX_REASONABLE_SMALL_PARCEL_HEIGHT_IN) &&
    weightOz > 0 &&
    weightOz <= 150 * 16
  )
}

function columnsClose(actual: number | null, expected: number | null): boolean {
  if (actual == null || expected == null) return actual == null && expected == null
  return Math.abs(actual - expected) < 0.03
}

export function listingPackageColumnsMatch(
  actual: ListingPackageColumns,
  expected: ListingPackageColumns,
): boolean {
  return (
    columnsClose(actual.shipping_packed_length_in, expected.shipping_packed_length_in) &&
    columnsClose(actual.shipping_packed_width_in, expected.shipping_packed_width_in) &&
    columnsClose(actual.shipping_packed_height_in, expected.shipping_packed_height_in) &&
    columnsClose(actual.shipping_packed_weight_oz, expected.shipping_packed_weight_oz) &&
    (actual.shipping_package_tier ?? null) === (expected.shipping_package_tier ?? null) &&
    (actual.shipping_package_band ?? null) === (expected.shipping_package_band ?? null)
  )
}

function customColumns(
  pkg: Pick<ShopSavedPackedSize, "lengthIn" | "widthIn" | "heightIn" | "weightLb">,
  tier: string | null,
): ListingPackageColumns {
  return {
    shipping_packed_length_in: round2(pkg.lengthIn),
    shipping_packed_width_in: round2(pkg.widthIn),
    shipping_packed_height_in: round2(pkg.heightIn),
    shipping_packed_weight_oz: round2(pkg.weightLb * 16),
    shipping_package_tier: tier,
    shipping_package_band: null,
  }
}

function tierForBoardSize(sizeId: ShopBoardPackSizeId): "shortboard" | "midlength" | "longboard" {
  if (sizeId === "midlength" || sizeId === "longboard") return sizeId
  return "shortboard"
}

function resolveReferencedPackage(
  defaults: ShopShippingDefaults,
  ref: string,
): ShopSavedPackedSize | null {
  if (ref === SHOP_STORE_DEFAULT_ID) return defaults.storeDefault
  if (isShopPackageSizeId(ref) && isShopPackageSizeAllowed("surfboards", ref)) {
    return shopPresetPackedSize(ref)
  }
  return defaults.savedPackages.find((pkg) => pkg.id === ref) ?? null
}

export function shopShippingColumnsForRef(
  defaults: ShopShippingDefaults,
  ref: string,
  boardSize: ShopBoardPackSizeId,
): ListingPackageColumns | null {
  const pkg = resolveReferencedPackage(defaults, ref)
  if (!pkg) return null
  if (pkg.presetId && isShopPackageSizeAllowed("surfboards", pkg.presetId)) {
    return listingPackageColumnsForShopSize("surfboards", pkg.presetId)
  }
  return customColumns(pkg, tierForBoardSize(boardSize))
}

export function shopShippingColumnsForSoftSection(
  defaults: ShopShippingDefaults,
  section: PeerListingSection,
): ListingPackageColumns | null {
  const pkg = defaults.storeDefault
  if (!pkg || section === "surfboards") return null
  if (pkg.presetId && isShopPackageSizeAllowed(section, pkg.presetId)) {
    return listingPackageColumnsForShopSize(section, pkg.presetId)
  }
  const columns = customColumns(pkg, null)
  return packageFitsSmallParcel(columns) ? columns : null
}

export function planShopShippingListingUpdates(input: {
  defaults: ShopShippingDefaults
  categoryPresets: ShopCategoryPackageSizeMap
  listings: ShopShippingListingTarget[]
}): ShopShippingApplyPlan {
  if (!input.defaults.physicalProduct) {
    return { updates: [], skippedBecausePackageDoesNotFit: 0 }
  }

  const updates: ShopShippingApplyPlan["updates"] = []
  let skippedBecausePackageDoesNotFit = 0

  for (const listing of input.listings) {
    if (listing.section === "surfboards") {
      const boardSize = shopBoardPackSizeForLength(listing.lengthTotalInches)
      if (!boardSize || listing.lengthTotalInches == null) continue
      const ref = input.defaults.boardSizes[boardSize] ?? SHOP_STORE_DEFAULT_ID
      const columns = shopShippingColumnsForRef(input.defaults, ref, boardSize)
      if (!columns) continue
      const cartonLength = columns.shipping_packed_length_in
      const coversBoard =
        cartonLength != null && cartonLength + 0.26 >= listing.lengthTotalInches
      if (!packageFitsSurfboardListing(columns) || !coversBoard) {
        skippedBecausePackageDoesNotFit += 1
        continue
      }
      if (!listingPackageColumnsMatch(listing.columns, columns)) {
        updates.push({ id: listing.id, columns })
      }
      continue
    }

    if (!isPeerListingSection(listing.section) || input.categoryPresets[listing.section]) continue
    const columns = shopShippingColumnsForSoftSection(input.defaults, listing.section)
    if (!columns) continue
    if (!listingPackageColumnsMatch(listing.columns, columns)) {
      updates.push({ id: listing.id, columns })
    }
  }

  return { updates, skippedBecausePackageDoesNotFit }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readPresetId(value: unknown): ShopPackageSizeId | null {
  if (typeof value !== "string" || !isShopPackageSizeId(value)) return null
  return value
}

function readPackage(value: unknown, id: string): ShopSavedPackedSize | null {
  if (!isRecord(value)) return null
  const name = typeof value.name === "string" ? value.name.trim() : ""
  const lengthIn = typeof value.lengthIn === "number" ? value.lengthIn : Number(value.lengthIn)
  const widthIn = typeof value.widthIn === "number" ? value.widthIn : Number(value.widthIn)
  const heightIn = typeof value.heightIn === "number" ? value.heightIn : Number(value.heightIn)
  const weightLb = typeof value.weightLb === "number" ? value.weightLb : Number(value.weightLb)
  if (!name || name.length > 48) return null
  if (![lengthIn, widthIn, heightIn, weightLb].every((n) => Number.isFinite(n) && n > 0)) return null
  if (lengthIn > 210 || widthIn > 80 || heightIn > 80 || weightLb > 150) return null
  return {
    id,
    name,
    lengthIn: round4(lengthIn),
    widthIn: round4(widthIn),
    heightIn: round4(heightIn),
    weightLb: round4(weightLb),
    presetId: readPresetId(value.presetId),
  }
}

function packageError(pkg: ShopShippingDraftPackage): string | null {
  if (!pkg.name.trim() || pkg.name.trim().length > 48) return "Name the packed size in 48 characters or fewer."
  if (pkg.lengthIn <= 0 || pkg.widthIn <= 0 || pkg.heightIn <= 0 || pkg.weightLb <= 0) {
    return "Enter length, width, height, and weight for the shop box."
  }
  if (pkg.lengthIn > 210 || pkg.widthIn > 80 || pkg.heightIn > 80 || pkg.weightLb > 150) {
    return "That package is larger than we can ship."
  }
  if (pkg.presetId && !isShopPackageSizeId(pkg.presetId)) return "That packed size isn't available."
  return null
}

function boardRefError(defaults: ShopShippingDefaults, ref: string): string | null {
  if (ref === SHOP_STORE_DEFAULT_ID) return null
  if (isShopBoardPackSizeId(ref)) return null
  if (SAVED_PACKAGE_ID.test(ref) && defaults.savedPackages.some((pkg) => pkg.id === ref)) return null
  return "Choose a saved packed size for that board length."
}

export function readShopShippingDefaults(value: unknown): ShopShippingDefaults {
  if (!isRecord(value)) return { ...EMPTY_SHOP_SHIPPING_DEFAULTS, boardSizes: {}, savedPackages: [] }
  const dimensionUnit =
    typeof value.dimensionUnit === "string" && isShopDimensionUnit(value.dimensionUnit)
      ? value.dimensionUnit
      : "in"
  const weightUnit =
    typeof value.weightUnit === "string" && isShopWeightUnit(value.weightUnit) ? value.weightUnit : "lb"
  const storeDefault = readPackage(value.storeDefault, SHOP_STORE_DEFAULT_ID)
  const savedPackages: ShopSavedPackedSize[] = []
  const seen = new Set<string>()
  if (Array.isArray(value.savedPackages)) {
    for (const entry of value.savedPackages) {
      if (!isRecord(entry) || typeof entry.id !== "string" || !SAVED_PACKAGE_ID.test(entry.id)) continue
      if (seen.has(entry.id)) continue
      const pkg = readPackage(entry, entry.id)
      if (!pkg) continue
      seen.add(entry.id)
      savedPackages.push(pkg)
      if (savedPackages.length >= SHOP_SAVED_PACKAGE_LIMIT) break
    }
  }
  const draft: ShopShippingDefaults = {
    physicalProduct: value.physicalProduct === false ? false : true,
    dimensionUnit,
    weightUnit,
    storeDefault,
    savedPackages,
    boardSizes: {},
  }
  if (isRecord(value.boardSizes)) {
    for (const [key, raw] of Object.entries(value.boardSizes)) {
      if (!isShopBoardPackSizeId(key) || typeof raw !== "string") continue
      if (boardRefError(draft, raw)) continue
      draft.boardSizes[key] = raw
    }
  }
  return draft
}

function readMeasure(raw: string): { kind: "empty" } | { kind: "value"; value: number } | { kind: "invalid" } {
  const trimmed = raw.trim()
  if (!trimmed) return { kind: "empty" }
  if (!MEASURE_INPUT.test(trimmed)) return { kind: "invalid" }
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) return { kind: "invalid" }
  if (value === 0) return { kind: "empty" }
  return { kind: "value", value }
}

export function shopShippingDefaultsFromDraft(
  draft: ShopShippingDraftInput,
): { ok: true; defaults: ShopShippingDefaults } | { ok: false; error: string } {
  let storeDefault: ShopSavedPackedSize | null = null
  if (draft.presetId) {
    if (!isShopPackageSizeId(draft.presetId)) return { ok: false, error: "That packed size isn't available." }
    storeDefault = storeDefaultFromPreset(draft.presetId)
    if (!storeDefault) return { ok: false, error: "That packed size isn't available." }
  } else {
    const parts = [draft.length, draft.width, draft.height, draft.weight].map(readMeasure)
    if (parts.some((part) => part.kind === "invalid")) {
      return { ok: false, error: "Enter length, width, height, and weight as numbers." }
    }
    const filled = parts.filter((part) => part.kind === "value")
    if (filled.length > 0 && filled.length < 4) {
      return { ok: false, error: "Enter length, width, height, and weight for the shop box." }
    }
    if (filled.length === 4) {
      const [length, width, height, weight] = parts
      if (
        length?.kind !== "value" ||
        width?.kind !== "value" ||
        height?.kind !== "value" ||
        weight?.kind !== "value"
      ) {
        return { ok: false, error: "Enter length, width, height, and weight for the shop box." }
      }
      const pkg: ShopSavedPackedSize = {
        id: SHOP_STORE_DEFAULT_ID,
        name: draft.name.trim() || SHOP_STORE_DEFAULT_PACKAGE_NAME,
        lengthIn: round4(lengthToInches(length.value, draft.dimensionUnit)),
        widthIn: round4(lengthToInches(width.value, draft.dimensionUnit)),
        heightIn: round4(lengthToInches(height.value, draft.dimensionUnit)),
        weightLb: round4(weightToLb(weight.value, draft.weightUnit)),
        presetId: null,
      }
      const invalid = packageError(pkg)
      if (invalid) return { ok: false, error: invalid }
      storeDefault = pkg
    }
  }

  if (draft.savedPackages.length > SHOP_SAVED_PACKAGE_LIMIT) {
    return { ok: false, error: "You can save up to 12 packed sizes." }
  }
  const seen = new Set<string>()
  for (const pkg of draft.savedPackages) {
    if (!SAVED_PACKAGE_ID.test(pkg.id) || seen.has(pkg.id)) {
      return { ok: false, error: "That packed size couldn't be saved." }
    }
    seen.add(pkg.id)
    const invalid = packageError(pkg)
    if (invalid) return { ok: false, error: invalid }
  }
  const savedPackages: ShopSavedPackedSize[] = draft.savedPackages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name.trim(),
    lengthIn: round4(pkg.lengthIn),
    widthIn: round4(pkg.widthIn),
    heightIn: round4(pkg.heightIn),
    weightLb: round4(pkg.weightLb),
    presetId: pkg.presetId && isShopPackageSizeId(pkg.presetId) ? pkg.presetId : null,
  }))
  const defaults: ShopShippingDefaults = {
    physicalProduct: draft.physicalProduct,
    dimensionUnit: draft.dimensionUnit,
    weightUnit: draft.weightUnit,
    storeDefault,
    savedPackages,
    boardSizes: {},
  }

  for (const [key, ref] of Object.entries(draft.boardSizes)) {
    if (!ref || ref === SHOP_STORE_DEFAULT_ID) continue
    if (!isShopBoardPackSizeId(key)) return { ok: false, error: "That board size isn't available." }
    const refError = boardRefError(defaults, ref)
    if (refError) return { ok: false, error: refError }
    defaults.boardSizes[key] = ref
  }

  return { ok: true, defaults }
}

export function shopShippingDraftFromDefaults(
  defaults: ShopShippingDefaults,
  suggestedPresetId?: string | null,
): ShopShippingDraftInput {
  const base: ShopShippingDraftInput = {
    physicalProduct: defaults.physicalProduct,
    dimensionUnit: defaults.dimensionUnit,
    weightUnit: defaults.weightUnit,
    name: SHOP_STORE_DEFAULT_PACKAGE_NAME,
    presetId: null,
    length: "",
    width: "",
    height: "",
    weight: "",
    savedPackages: defaults.savedPackages,
    boardSizes: { ...defaults.boardSizes },
  }
  const stored = defaults.storeDefault
  const suggested =
    !stored && suggestedPresetId && isShopPackageSizeId(suggestedPresetId)
      ? storeDefaultFromPreset(suggestedPresetId)
      : null
  const pkg = stored ?? suggested
  if (!pkg) return base
  return {
    ...base,
    name: pkg.name,
    presetId: pkg.presetId,
    length: formatShopMeasure(lengthFromInches(pkg.lengthIn, defaults.dimensionUnit)),
    width: formatShopMeasure(lengthFromInches(pkg.widthIn, defaults.dimensionUnit)),
    height: formatShopMeasure(lengthFromInches(pkg.heightIn, defaults.dimensionUnit)),
    weight: formatShopMeasure(weightFromLb(pkg.weightLb, defaults.weightUnit)),
  }
}

export function shopShippingDefaultsToJson(defaults: ShopShippingDefaults): Record<string, unknown> {
  return {
    physicalProduct: defaults.physicalProduct,
    dimensionUnit: defaults.dimensionUnit,
    weightUnit: defaults.weightUnit,
    storeDefault: defaults.storeDefault,
    savedPackages: defaults.savedPackages,
    boardSizes: defaults.boardSizes,
  }
}

export function emptyListingPackageColumns(): ListingPackageColumns {
  return {
    shipping_packed_length_in: null,
    shipping_packed_width_in: null,
    shipping_packed_height_in: null,
    shipping_packed_weight_oz: null,
    shipping_package_tier: null,
    shipping_package_band: null,
  }
}

export function listingPackageColumnsFromRow(row: {
  shipping_packed_length_in?: unknown
  shipping_packed_width_in?: unknown
  shipping_packed_height_in?: unknown
  shipping_packed_weight_oz?: unknown
  shipping_package_tier?: unknown
  shipping_package_band?: unknown
}): ListingPackageColumns {
  const num = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }
  const text = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null
  return {
    shipping_packed_length_in: num(row.shipping_packed_length_in),
    shipping_packed_width_in: num(row.shipping_packed_width_in),
    shipping_packed_height_in: num(row.shipping_packed_height_in),
    shipping_packed_weight_oz: num(row.shipping_packed_weight_oz),
    shipping_package_tier: text(row.shipping_package_tier),
    shipping_package_band: text(row.shipping_package_band),
  }
}

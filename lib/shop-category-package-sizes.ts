import {
  PEER_LISTING_SECTIONS,
  SELLER_PROFILE_SECTION_SORT_ORDER,
  isPeerListingSection,
  type PeerListingSection,
} from "@/lib/peer-listing-sections"
import { reswellPackageFieldsToDb } from "@/lib/sell-listing-fulfillment-flags"
import { SURFBOARD_SHIPPING_PACK_BANDS } from "@/lib/surfboard-shipping-pack-bands"
import { SURFBOARD_SHIPPING_TIERS } from "@/lib/surfboard-shipping-tiers"

/** Shop-level packed-box choice. Surfboard ids match existing shipping tiers and pack bands. */
export const SHOP_PACKAGE_SIZE_IDS = [
  "shortboard_compact",
  "shortboard_medium",
  "midlength",
  "longboard",
  "small",
  "medium",
  "large",
] as const

export type ShopPackageSizeId = (typeof SHOP_PACKAGE_SIZE_IDS)[number]

export type ShopCategoryPackageSizeMap = Partial<Record<PeerListingSection, ShopPackageSizeId>>

export type ListingPackageColumns = {
  shipping_packed_length_in: number | null
  shipping_packed_width_in: number | null
  shipping_packed_height_in: number | null
  shipping_packed_weight_oz: number | null
  shipping_package_tier: string | null
  shipping_package_band: string | null
}

type SoftPackagePreset = {
  id: "small" | "medium" | "large"
  label: string
  summary: string
  lengthIn: number
  widthIn: number
  heightIn: number
  weightOz: number
}

const SOFT_PACKAGE_PRESETS: Record<SoftPackagePreset["id"], SoftPackagePreset> = {
  small: {
    id: "small",
    label: "Small",
    summary: "12 × 10 × 4 in · 2 lb",
    lengthIn: 12,
    widthIn: 10,
    heightIn: 4,
    weightOz: 32,
  },
  medium: {
    id: "medium",
    label: "Medium",
    summary: "18 × 14 × 6 in · 3 lb",
    lengthIn: 18,
    widthIn: 14,
    heightIn: 6,
    weightOz: 48,
  },
  large: {
    id: "large",
    label: "Large",
    summary: "36 × 16 × 8 in · 6 lb",
    lengthIn: 36,
    widthIn: 16,
    heightIn: 8,
    weightOz: 96,
  },
}

const SURFBOARD_SIZE_IDS: ShopPackageSizeId[] = [
  "shortboard_compact",
  "shortboard_medium",
  "midlength",
  "longboard",
]
const SOFT_SIZE_IDS: ShopPackageSizeId[] = ["small", "medium", "large"]

const SOFT_SIZE_SET = new Set<string>(SOFT_SIZE_IDS)

export function isShopPackageSizeId(value: string): value is ShopPackageSizeId {
  return (SHOP_PACKAGE_SIZE_IDS as readonly string[]).includes(value)
}

export function shopPackageSizesForSection(section: PeerListingSection): ShopPackageSizeId[] {
  return section === "surfboards" ? SURFBOARD_SIZE_IDS : SOFT_SIZE_IDS
}

export function isShopPackageSizeAllowed(
  section: PeerListingSection,
  sizeId: string,
): sizeId is ShopPackageSizeId {
  return shopPackageSizesForSection(section).includes(sizeId as ShopPackageSizeId)
}

export function shopPackageCategoryOrder(): PeerListingSection[] {
  const preferred = SELLER_PROFILE_SECTION_SORT_ORDER.filter((section) =>
    isPeerListingSection(section),
  )
  const rest = PEER_LISTING_SECTIONS.filter(
    (section) => !(preferred as readonly string[]).includes(section),
  )
  return [...preferred, ...rest]
}

export function shopPackageSizeLabel(sizeId: ShopPackageSizeId): string {
  if (sizeId === "shortboard_compact") return "Shortboard · Compact"
  if (sizeId === "shortboard_medium") return "Shortboard · Medium"
  if (sizeId === "midlength") return SURFBOARD_SHIPPING_TIERS.midlength.label
  if (sizeId === "longboard") return SURFBOARD_SHIPPING_TIERS.longboard.label
  return SOFT_PACKAGE_PRESETS[sizeId].label
}

export function shopPackageSizeSummary(sizeId: ShopPackageSizeId): string {
  if (sizeId === "shortboard_compact") return SURFBOARD_SHIPPING_PACK_BANDS.shortboard_compact.summary
  if (sizeId === "shortboard_medium") return SURFBOARD_SHIPPING_PACK_BANDS.shortboard_medium.summary
  if (sizeId === "midlength") return SURFBOARD_SHIPPING_TIERS.midlength.summary
  if (sizeId === "longboard") return SURFBOARD_SHIPPING_TIERS.longboard.summary
  return SOFT_PACKAGE_PRESETS[sizeId].summary
}

export function listingPackageColumnsForShopSize(
  section: PeerListingSection,
  sizeId: ShopPackageSizeId,
): ListingPackageColumns | null {
  if (!isShopPackageSizeAllowed(section, sizeId)) return null

  if (section === "surfboards") {
    if (sizeId === "shortboard_compact" || sizeId === "shortboard_medium") {
      return reswellPackageFieldsToDb({
        boardShippingCostMode: "reswell",
        surfboardShippingTier: "shortboard",
        surfboardShippingPackBand: sizeId,
        category: "surfboards",
      })
    }
    if (sizeId === "midlength" || sizeId === "longboard") {
      return reswellPackageFieldsToDb({
        boardShippingCostMode: "reswell",
        surfboardShippingTier: sizeId,
        category: "surfboards",
      })
    }
    return null
  }

  if (!SOFT_SIZE_SET.has(sizeId)) return null
  const preset = SOFT_PACKAGE_PRESETS[sizeId as SoftPackagePreset["id"]]
  return {
    shipping_packed_length_in: preset.lengthIn,
    shipping_packed_width_in: preset.widthIn,
    shipping_packed_height_in: preset.heightIn,
    shipping_packed_weight_oz: preset.weightOz,
    shipping_package_tier: null,
    shipping_package_band: null,
  }
}

export type ListingPackageSnapshot = {
  section: string
  shipping_package_tier?: string | null
  shipping_package_band?: string | null
  shipping_packed_length_in?: number | null
  shipping_packed_width_in?: number | null
  shipping_packed_height_in?: number | null
  shipping_packed_weight_oz?: number | null
}

function dimsClose(actual: number | null | undefined, expected: number): boolean {
  if (actual == null || !Number.isFinite(actual)) return false
  return Math.abs(actual - expected) < 0.26
}

function snapshotMatchesColumns(
  row: ListingPackageSnapshot,
  columns: ListingPackageColumns,
): boolean {
  return (
    dimsClose(row.shipping_packed_length_in, columns.shipping_packed_length_in ?? NaN) &&
    dimsClose(row.shipping_packed_width_in, columns.shipping_packed_width_in ?? NaN) &&
    dimsClose(row.shipping_packed_height_in, columns.shipping_packed_height_in ?? NaN) &&
    dimsClose(row.shipping_packed_weight_oz, columns.shipping_packed_weight_oz ?? NaN)
  )
}

function hasAnyPackageData(row: ListingPackageSnapshot): boolean {
  return (
    row.shipping_package_tier != null ||
    row.shipping_package_band != null ||
    row.shipping_packed_length_in != null ||
    row.shipping_packed_width_in != null ||
    row.shipping_packed_height_in != null ||
    row.shipping_packed_weight_oz != null
  )
}

/** Map a listing's stored box back to a shop preset, or `custom` when it doesn't match one. */
export function inferShopPackageSizeId(
  row: ListingPackageSnapshot,
): ShopPackageSizeId | "custom" | null {
  if (!isPeerListingSection(row.section)) {
    return hasAnyPackageData(row) ? "custom" : null
  }

  if (row.section === "surfboards") {
    const band = row.shipping_package_band
    if (band === "shortboard_compact" || band === "shortboard_medium") {
      const columns = listingPackageColumnsForShopSize("surfboards", band)
      if (columns && (snapshotMatchesColumns(row, columns) || row.shipping_packed_length_in == null)) {
        return band
      }
      return band
    }
    const tier = row.shipping_package_tier
    if (tier === "midlength" || tier === "longboard") {
      return tier
    }
    if (tier === "shortboard") return "custom"
    return hasAnyPackageData(row) ? "custom" : null
  }

  for (const sizeId of SOFT_SIZE_IDS) {
    const columns = listingPackageColumnsForShopSize(row.section, sizeId)
    if (columns && snapshotMatchesColumns(row, columns)) return sizeId
  }
  return hasAnyPackageData(row) ? "custom" : null
}

export function parseShopCategoryPackageSizeMap(value: unknown): ShopCategoryPackageSizeMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const next: ShopCategoryPackageSizeMap = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!isPeerListingSection(key) || typeof raw !== "string") continue
    if (!isShopPackageSizeAllowed(key, raw)) continue
    next[key] = raw
  }
  return next
}

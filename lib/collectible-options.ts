/** Stored in listings.collectible_type — subcategory for Collectibles & Vintage */
export const COLLECTIBLE_TYPE_OPTIONS = [
  { value: "vintage_surfboards", label: "Vintage Surfboards" },
  { value: "vintage_apparel", label: "Vintage Apparel" },
  { value: "surf_art", label: "Surf Art & Prints" },
  { value: "media_magazines", label: "Media & Magazines" },
  { value: "vintage_gear", label: "Vintage Gear & Accessories" },
  { value: "rare_archive", label: "Rare & Archive" },
] as const

export const COLLECTIBLE_TYPE_VALUES = COLLECTIBLE_TYPE_OPTIONS.map((o) => o.value) as unknown as readonly CollectibleTypeValue[]

export type CollectibleTypeValue = (typeof COLLECTIBLE_TYPE_OPTIONS)[number]["value"]

export function collectibleTypeLabel(value: string): string {
  const opt = COLLECTIBLE_TYPE_OPTIONS.find((o) => o.value === value)
  return opt?.label ?? value
}

/** Stored in listings.collectible_era */
export const COLLECTIBLE_ERA_OPTIONS = [
  { value: "70s", label: "1970s" },
  { value: "80s", label: "1980s" },
  { value: "90s", label: "1990s" },
  { value: "2000s", label: "2000s" },
] as const

export const COLLECTIBLE_ERA_VALUES = COLLECTIBLE_ERA_OPTIONS.map((o) => o.value) as unknown as readonly CollectibleEraValue[]

export type CollectibleEraValue = (typeof COLLECTIBLE_ERA_OPTIONS)[number]["value"]

export function collectibleEraLabel(value: string): string {
  const opt = COLLECTIBLE_ERA_OPTIONS.find((o) => o.value === value)
  return opt?.label ?? value
}

/** Stored in listings.collectible_condition — distinct from the generic listing `condition` */
export const COLLECTIBLE_CONDITION_OPTIONS = [
  { value: "mint", label: "Mint" },
  { value: "good", label: "Good" },
  { value: "restored", label: "Restored" },
  { value: "display_only", label: "Display Only" },
] as const

export const COLLECTIBLE_CONDITION_VALUES = COLLECTIBLE_CONDITION_OPTIONS.map((o) => o.value) as unknown as readonly CollectibleConditionValue[]

export type CollectibleConditionValue = (typeof COLLECTIBLE_CONDITION_OPTIONS)[number]["value"]

export function collectibleConditionLabel(value: string): string {
  const opt = COLLECTIBLE_CONDITION_OPTIONS.find((o) => o.value === value)
  return opt?.label ?? value
}

export function normalizeCollectibleTypeParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (COLLECTIBLE_TYPE_VALUES as readonly string[]).includes(v) ? v : "all"
}

export function normalizeCollectibleEraParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (COLLECTIBLE_ERA_VALUES as readonly string[]).includes(v) ? v : "all"
}

export function normalizeCollectibleConditionParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (COLLECTIBLE_CONDITION_VALUES as readonly string[]).includes(v) ? v : "all"
}

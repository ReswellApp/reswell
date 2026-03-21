/** Stored in listings.apparel_kind; labels for UI */
export const APPAREL_KIND_OPTIONS = [
  { value: "shirt", label: "Shirts" },
  { value: "boardshorts", label: "Boardshorts" },
  { value: "bikini", label: "Bikinis" },
  { value: "jacket", label: "Jackets" },
  { value: "changing_towel", label: "Changing towels" },
  { value: "towel", label: "Towels" },
] as const

export type ApparelKindValue = (typeof APPAREL_KIND_OPTIONS)[number]["value"]

export const APPAREL_KIND_VALUES: readonly ApparelKindValue[] = APPAREL_KIND_OPTIONS.map(
  (o) => o.value,
) as unknown as readonly ApparelKindValue[]

export function apparelKindLabel(value: string): string {
  const row = APPAREL_KIND_OPTIONS.find((o) => o.value === value)
  return row?.label ?? value
}

export function normalizeApparelKindParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (APPAREL_KIND_VALUES as readonly string[]).includes(v) ? v : "all"
}

/** Stored in listings.gear_size for Apparel & Lifestyle listings */
export const APPAREL_SIZE_OPTIONS = ["XS", "S", "M", "L", "XL"] as const

export type ApparelSizeValue = (typeof APPAREL_SIZE_OPTIONS)[number]

export function normalizeApparelSizeParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (APPAREL_SIZE_OPTIONS as readonly string[]).includes(v) ? v : "all"
}

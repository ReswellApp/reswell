/** Shared fixed facet values for used gear category pages (fins, surfpacks & bags, etc.) */
export const USED_GEAR_SIZE_OPTIONS = ["XS", "S", "M", "L"] as const

/** Fin type / box system — stored in `listings.brand` for fins category. */
export const FINS_TYPE_OPTIONS = ["FCS", "Futures", "Single Fin"] as const

/** Longboard / single-fin length (inches) — shown when fin type is Single Fin. */
export const SINGLE_FIN_SIZE_OPTIONS = ["6.5", "7", "7.5", "8.0", "8.5", "9.0"] as const

export const USED_GEAR_COLOR_OPTIONS = [
  "Black",
  "White",
  "Red",
  "Green",
  "Blue",
  "Yellow",
  "Pink",
  "Purple",
  "Grey",
  "Tan",
] as const

const FINS_FILTER_SIZE_OPTIONS: readonly string[] = [
  ...USED_GEAR_SIZE_OPTIONS,
  ...SINGLE_FIN_SIZE_OPTIONS,
]

export function normalizeUsedGearSizeParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return FINS_FILTER_SIZE_OPTIONS.includes(v) ? v : "all"
}

export function normalizeUsedGearColorParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (USED_GEAR_COLOR_OPTIONS as readonly string[]).includes(v) ? v : "all"
}

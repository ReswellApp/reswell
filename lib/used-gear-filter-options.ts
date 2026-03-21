/** Shared fixed facet values for used gear category pages (fins, surfpacks & bags, etc.) */
export const USED_GEAR_SIZE_OPTIONS = ["XS", "S", "M", "L"] as const

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

export function normalizeUsedGearSizeParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (USED_GEAR_SIZE_OPTIONS as readonly string[]).includes(v) ? v : "all"
}

export function normalizeUsedGearColorParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (USED_GEAR_COLOR_OPTIONS as readonly string[]).includes(v) ? v : "all"
}

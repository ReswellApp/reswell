/** Stored in listings.leash_length — feet as string digit(s) */
export const LEASH_LENGTH_FT_OPTIONS = ["6", "8", "9", "10"] as const

export type LeashLengthValue = (typeof LEASH_LENGTH_FT_OPTIONS)[number]

export function leashLengthLabel(value: string): string {
  if ((LEASH_LENGTH_FT_OPTIONS as readonly string[]).includes(value)) return `${value} ft`
  return value
}

/** Stored in listings.leash_thickness — cord diameter in inches (fractions) */
export const LEASH_THICKNESS_OPTIONS = ["3/16", "1/4", "5/16"] as const

export type LeashThicknessValue = (typeof LEASH_THICKNESS_OPTIONS)[number]

export function normalizeLeashLengthParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (LEASH_LENGTH_FT_OPTIONS as readonly string[]).includes(v) ? v : "all"
}

export function normalizeLeashThicknessParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (LEASH_THICKNESS_OPTIONS as readonly string[]).includes(v) ? v : "all"
}

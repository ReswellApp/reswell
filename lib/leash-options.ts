/** Stored in listings.leash_length — feet as string digit(s) */
export const LEASH_LENGTH_FT_OPTIONS = ["5", "6", "7", "8", "9", "10", "11", "12"] as const

export type LeashLengthValue = (typeof LEASH_LENGTH_FT_OPTIONS)[number]

export function leashLengthLabel(value: string): string {
  if ((LEASH_LENGTH_FT_OPTIONS as readonly string[]).includes(value)) return `${value}'`
  return value
}

/** Stored in listings.leash_thickness */
export const LEASH_THICKNESS_MM_OPTIONS = ["5mm", "6mm", "7mm", "8mm", "9mm", "10mm"] as const

export type LeashThicknessValue = (typeof LEASH_THICKNESS_MM_OPTIONS)[number]

export function normalizeLeashLengthParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (LEASH_LENGTH_FT_OPTIONS as readonly string[]).includes(v) ? v : "all"
}

export function normalizeLeashThicknessParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (LEASH_THICKNESS_MM_OPTIONS as readonly string[]).includes(v) ? v : "all"
}

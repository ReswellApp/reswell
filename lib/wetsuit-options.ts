/** Stored in listings.wetsuit_size */
export const WETSUIT_SIZE_OPTIONS = [
  "XS",
  "S",
  "M",
  "MS",
  "MT",
  "L",
  "LS",
  "LT",
  "XL",
  "XLS",
  "XLT",
  "XXL",
] as const

export type WetsuitSizeValue = (typeof WETSUIT_SIZE_OPTIONS)[number]

/** Stored in listings.wetsuit_thickness */
export const WETSUIT_THICKNESS_OPTIONS = ["2/2", "3/2", "4/3", "5/4", "6/4/3", "6/5"] as const

export type WetsuitThicknessValue = (typeof WETSUIT_THICKNESS_OPTIONS)[number]

/** Stored in listings.wetsuit_zip_type */
export const WETSUIT_ZIP_OPTIONS = [
  { value: "hooded", label: "Hooded" },
  { value: "chestzip", label: "Chestzip" },
  { value: "backzip", label: "Backzip" },
] as const

export type WetsuitZipValue = (typeof WETSUIT_ZIP_OPTIONS)[number]["value"]

export const WETSUIT_ZIP_VALUES: readonly WetsuitZipValue[] = WETSUIT_ZIP_OPTIONS.map((o) => o.value)

export function wetsuitZipLabel(value: string): string {
  if (value === "non_hooded") return "Chestzip"
  const row = WETSUIT_ZIP_OPTIONS.find((o) => o.value === value)
  return row?.label ?? value
}

export function normalizeWetsuitSizeParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (WETSUIT_SIZE_OPTIONS as readonly string[]).includes(v) ? v : "all"
}

export function normalizeWetsuitThicknessParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (WETSUIT_THICKNESS_OPTIONS as readonly string[]).includes(v) ? v : "all"
}

export function normalizeWetsuitZipParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  if (v === "non_hooded") return "chestzip"
  return (WETSUIT_ZIP_VALUES as readonly string[]).includes(v) ? v : "all"
}

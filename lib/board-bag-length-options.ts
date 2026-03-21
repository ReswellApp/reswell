/** Fits lengths for used board bags — stored in listings.gear_size */
export const BOARD_BAG_LENGTH_OPTIONS = [
  `5'8"`,
  `6'0"`,
  `6'3"`,
  `6'6"`,
  `7'0"`,
  `7'6"`,
  `8'0"`,
  `8'6"`,
  `9'0"`,
  `9'6"`,
] as const

export function normalizeBoardBagSizeParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return (BOARD_BAG_LENGTH_OPTIONS as readonly string[]).includes(v) ? v : "all"
}

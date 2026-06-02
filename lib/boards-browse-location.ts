export const BOARD_RADIUS_VALUES = ["25", "50", "100", "200"] as const

export const boardRadiusOptions: { value: string; label: string }[] = [
  { value: "any", label: "Radius" },
  ...BOARD_RADIUS_VALUES.map((mi) => ({ value: mi, label: `${mi} mi` })),
]

export function normalizeBoardBrowseRadius(r: string | null): string {
  const t = (r ?? "").trim()
  return BOARD_RADIUS_VALUES.includes(t as (typeof BOARD_RADIUS_VALUES)[number]) ? t : "any"
}

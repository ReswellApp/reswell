/** Clockwise quarter-turns applied after EXIF auto-orientation (0 = none, 1 = 90°, …). */
export type SurferImageQuarterTurns = 0 | 1 | 2 | 3

export function normalizeSurferImageQuarterTurns(n: number): SurferImageQuarterTurns {
  if (!Number.isFinite(n)) return 0
  const m = Math.floor(((n % 4) + 4) % 4)
  return m as SurferImageQuarterTurns
}

/** Tailwind classes for `<img>` preview (matches server Sharp rotation). */
export function surferImagePreviewRotateClass(quarterTurns: number): string {
  switch (normalizeSurferImageQuarterTurns(quarterTurns)) {
    case 0:
      return ""
    case 1:
      return "rotate-90"
    case 2:
      return "rotate-180"
    case 3:
      return "-rotate-90"
    default:
      return ""
  }
}

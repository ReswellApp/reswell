/**
 * Guided = one wizard step at a time (Next / Back).
 * Advanced = all sell sections on one scrollable page.
 */
export const BOARD_SELL_VIEW_MODES = ["guided", "advanced"] as const

export type BoardSellViewMode = (typeof BOARD_SELL_VIEW_MODES)[number]

const BOARD_VIEW_MODE_KEY = "reswell.sell.board.viewMode"

export function parseBoardSellViewMode(value: unknown): BoardSellViewMode | null {
  if (value === "guided" || value === "advanced") return value
  return null
}

export function readStoredBoardSellViewMode(): BoardSellViewMode | null {
  if (typeof window === "undefined") return null
  try {
    return parseBoardSellViewMode(sessionStorage.getItem(BOARD_VIEW_MODE_KEY))
  } catch {
    return null
  }
}

export function persistBoardSellViewMode(mode: BoardSellViewMode): void {
  try {
    sessionStorage.setItem(BOARD_VIEW_MODE_KEY, mode)
  } catch {
    /* quota / private mode */
  }
}

export type BoardSellPickerMode = BoardSellViewMode | "quick"

export function boardSellViewModeLabel(mode: BoardSellPickerMode): string {
  if (mode === "quick") return "Quick list"
  return mode === "guided" ? "Guided view" : "Advanced view"
}

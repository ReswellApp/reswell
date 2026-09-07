import { sellFlowStepSessionKey } from "@/lib/sell-flow/session-keys"

/** Reverb-style 4-tier board sell wizard. */
export const BOARD_SELL_FLOW_STEPS = [
  "product",
  "photos",
  "pricing",
  "shipping",
] as const

export type BoardSellFlowStep = (typeof BOARD_SELL_FLOW_STEPS)[number]

export const BOARD_SELL_SECTION_ID_BY_STEP: Record<BoardSellFlowStep, string> = {
  product: "sell-section-product",
  photos: "sell-section-photos",
  pricing: "sell-section-pricing",
  shipping: "sell-section-shipping",
}

export const BOARD_SELL_STEP_BY_SECTION_ID: Record<string, BoardSellFlowStep> = {
  "sell-section-product": "product",
  "sell-section-photos": "photos",
  "sell-section-pricing": "pricing",
  "sell-section-shipping": "shipping",
}

const BOARD_FLOW_STEP_KEY =
  sellFlowStepSessionKey("board") ?? "reswell.sell.board.flowStep"

/** Map legacy 5-step draft/session values onto the 4-tier wizard. */
function migrateLegacyBoardSellFlowStep(value: string): BoardSellFlowStep | null {
  switch (value) {
    case "basics":
    case "details":
      return "product"
    case "photos":
      return "photos"
    case "publish":
      return "pricing"
    case "delivery":
      return "shipping"
    default:
      return null
  }
}

export function parseBoardSellFlowStep(value: unknown): BoardSellFlowStep | null {
  if (
    value === "product" ||
    value === "photos" ||
    value === "pricing" ||
    value === "shipping"
  ) {
    return value
  }
  if (typeof value === "string") {
    return migrateLegacyBoardSellFlowStep(value)
  }
  return null
}

export function readStoredBoardSellFlowStep(): BoardSellFlowStep | null {
  if (typeof window === "undefined") return null
  try {
    return parseBoardSellFlowStep(sessionStorage.getItem(BOARD_FLOW_STEP_KEY))
  } catch {
    return null
  }
}

export function persistBoardSellFlowStep(step: BoardSellFlowStep): void {
  try {
    sessionStorage.setItem(BOARD_FLOW_STEP_KEY, step)
  } catch {
    /* quota / private mode */
  }
}

export function clearPersistedBoardSellFlowStep(): void {
  try {
    sessionStorage.removeItem(BOARD_FLOW_STEP_KEY)
  } catch {
    /* ignore */
  }
}

export function boardSellFlowStepIndex(step: BoardSellFlowStep): number {
  return BOARD_SELL_FLOW_STEPS.indexOf(step)
}

export function nextBoardSellFlowStep(step: BoardSellFlowStep): BoardSellFlowStep | null {
  const i = boardSellFlowStepIndex(step)
  if (i < 0 || i >= BOARD_SELL_FLOW_STEPS.length - 1) return null
  return BOARD_SELL_FLOW_STEPS[i + 1] ?? null
}

export function prevBoardSellFlowStep(step: BoardSellFlowStep): BoardSellFlowStep | null {
  const i = boardSellFlowStepIndex(step)
  if (i <= 0) return null
  return BOARD_SELL_FLOW_STEPS[i - 1] ?? null
}

import { sellFlowStepSessionKey } from "@/lib/sell-flow/session-keys"

export const BOARD_SELL_FLOW_STEPS = [
  "basics",
  "details",
  "delivery",
  "publish",
] as const

export type BoardSellFlowStep = (typeof BOARD_SELL_FLOW_STEPS)[number]

export const BOARD_SELL_SECTION_ID_BY_STEP: Record<BoardSellFlowStep, string> = {
  basics: "sell-section-basics",
  details: "sell-section-details",
  delivery: "sell-section-delivery",
  publish: "sell-section-publish",
}

export const BOARD_SELL_STEP_BY_SECTION_ID: Record<string, BoardSellFlowStep> = {
  "sell-section-basics": "basics",
  "sell-section-details": "details",
  "sell-section-delivery": "delivery",
  "sell-section-publish": "publish",
}

const BOARD_FLOW_STEP_KEY =
  sellFlowStepSessionKey("board") ?? "reswell.sell.board.flowStep"

export function parseBoardSellFlowStep(value: unknown): BoardSellFlowStep | null {
  if (
    value === "basics" ||
    value === "details" ||
    value === "delivery" ||
    value === "publish"
  ) {
    return value
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

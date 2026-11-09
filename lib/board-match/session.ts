import { BOARD_MATCH_DECK, BOARD_MATCH_ROUND_SIZE } from "@/lib/board-match/deck"
import type { BoardMatchScenario } from "@/lib/types/boardMatch"
import type { SurfboardSellCategoryKey } from "@/lib/surfboard-sell-categories"

function shuffleInPlace<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const tmp = items[i]!
    items[i] = items[j]!
    items[j] = tmp
  }
  return items
}

/**
 * Build a playable round: shuffled scenarios with shuffled choices per card.
 * Pass `random` for deterministic tests.
 */
export function buildBoardMatchRound(
  roundSize: number = BOARD_MATCH_ROUND_SIZE,
  random: () => number = Math.random,
): BoardMatchScenario[] {
  const size = Math.min(Math.max(1, roundSize), BOARD_MATCH_DECK.length)
  const picked = shuffleInPlace([...BOARD_MATCH_DECK], random).slice(0, size)

  return picked.map((scenario) => ({
    ...scenario,
    choices: shuffleInPlace([...scenario.choices], random) as SurfboardSellCategoryKey[],
  }))
}

export function boardMatchShopHref(boardType: SurfboardSellCategoryKey | null): string {
  if (!boardType || boardType === "other") return "/boards"
  return `/boards?type=${encodeURIComponent(boardType)}`
}

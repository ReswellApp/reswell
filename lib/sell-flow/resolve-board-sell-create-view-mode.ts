import type { BoardSellViewMode } from "@/lib/sell-flow/board-sell-view-mode"

/**
 * Default surfboard create view.
 *
 * Giveaway first-timers get Quick list (shortest path to a live board).
 * Anyone who has already published a surfboard gets Guided.
 * Catalog handoffs stay Guided so brand/model prefill is visible.
 */
export function resolveBoardSellCreateViewMode(opts: {
  fromGiveaway: boolean
  hasPublishedSurfboard: boolean
  catalogHandoff?: boolean
  storedMode?: BoardSellViewMode | null
}): BoardSellViewMode {
  if (opts.catalogHandoff) return "guided"
  if (opts.hasPublishedSurfboard) return opts.storedMode ?? "guided"
  if (opts.fromGiveaway) return "quick"
  return opts.storedMode ?? "guided"
}

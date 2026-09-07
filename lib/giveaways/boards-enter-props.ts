import {
  getGiveawayBySlug,
  isGiveawayOpen,
  WIN_A_SURFBOARD_GIVEAWAY_SLUG,
} from "@/lib/giveaways/catalog"
import type { Giveaway } from "@/lib/types/giveaways"

/**
 * Open raffle for the `/boards` CTA. Auth / already-entered hiding is handled
 * client-side so ISR on `/boards` cannot serve a stale “show” shell to entrants.
 */
export function getOpenBoardsGiveaway(): Giveaway | null {
  const giveaway = getGiveawayBySlug(WIN_A_SURFBOARD_GIVEAWAY_SLUG)
  if (!giveaway || !isGiveawayOpen(giveaway)) return null
  return giveaway
}

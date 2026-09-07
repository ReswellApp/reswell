import { logGiveawayEventAction } from "@/lib/actions/giveawayEventActions"
import type {
  GiveawayEventKind,
  GiveawayEventSurface,
  GiveawayPrizeBrandId,
} from "@/lib/types/giveaways"

export function logGiveawayEvent(params: {
  slug: string
  event: GiveawayEventKind
  surface: GiveawayEventSurface
  preferredBrand?: GiveawayPrizeBrandId | null
}): void {
  void logGiveawayEventAction(params).catch(() => {
    /* analytics must never affect the giveaway UI */
  })
}

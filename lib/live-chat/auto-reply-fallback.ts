/**
 * Catch-path reply when generate or persist fails.
 * Label-update and this-order lookup already have tiles on screen — point at those
 * instead of asking for an order number.
 */

import { LIVE_CHAT_UNGROUNDED_REPLY } from "./live-chat-cs-prompt.ts"
import { isLiveChatShipFromLabelUpdateIntent } from "./label-update-intent.ts"
import { isLiveChatSpecificOrderLookupIntent } from "./order-tile-intent.ts"

/** Deterministic reply when eligible undropped-off sales exist (panel shows tiles). */
export const LIVE_CHAT_LABEL_UPDATE_REPLY =
  "You can update the ship-from address on a label for sales still waiting for carrier drop-off. Use the tiles below — pick the sale, say why, then choose the ship-from address. Ship-to stays the same."

/** When nothing is eligible — don't pin them in the label flow. */
export const LIVE_CHAT_LABEL_UPDATE_EMPTY_REPLY =
  "I don't see any of your sales with a label still waiting for carrier drop-off, so we can't reprint a ship-from label from here right now. If a label already scanned or the sale shipped, ship-from can't change. Tell me the order number or what else you need help with."

/** Deterministic reply when this-order tiles are on screen. */
export const LIVE_CHAT_ORDER_TILE_REPLY =
  "Tap the order below and I'll look that one up."

export function liveChatCsAgentCatchFallback(visitorContent: string): string {
  if (isLiveChatShipFromLabelUpdateIntent(visitorContent)) {
    return LIVE_CHAT_LABEL_UPDATE_REPLY
  }
  if (isLiveChatSpecificOrderLookupIntent(visitorContent)) {
    return LIVE_CHAT_ORDER_TILE_REPLY
  }
  return LIVE_CHAT_UNGROUNDED_REPLY
}

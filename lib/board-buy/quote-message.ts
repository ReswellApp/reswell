import type { BoardBuyStatus } from "@/lib/board-buy/constants"
import type { BoardBuySubmission } from "@/lib/types/board-buy"

export function defaultBoardBuyQuoteMessage(input: {
  status: BoardBuyStatus
  quoteSource: "ops" | "auto_sla" | null
  offeredPrice: number | null
  askingPrice: number
}): string {
  if (input.status === "declined") {
    return "We’re not able to buy this board right now. You’re welcome to list it on the marketplace instead."
  }
  if (input.status === "submitted") {
    return "We’re reviewing your photos and asking price. You’ll see our offer on this page."
  }
  if (input.offeredPrice != null && input.offeredPrice === input.askingPrice) {
    return "We’ll buy this board at your asking price. Accept below, then box it (max 22\" × 5\" W × H) and send packed measurements so we can purchase your prepaid label."
  }
  if (input.offeredPrice != null) {
    return "Here’s our offer for this board. Accept to sell it to Reswell, then box it (max 22\" × 5\" W × H) and send packed measurements for a prepaid label."
  }
  return "We’ll reply on this quote with an accept or our best offer."
}

export function sellerVisibleQuoteMessage(submission: BoardBuySubmission): string {
  const custom = submission.quoteMessage?.trim()
  if (
    submission.status === "accepted" ||
    submission.status === "label_ready" ||
    submission.status === "received" ||
    submission.status === "paid"
  ) {
    return "You accepted this offer. Follow the shipping steps on this quote. We’ll pay your wallet after the board arrives."
  }
  if (custom) return custom
  return defaultBoardBuyQuoteMessage(submission)
}

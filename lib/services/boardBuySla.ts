import { computeAutoOfferUsd } from "@/lib/board-buy/constants"
import {
  getBoardBuySubmissionById,
  listSubmittedPastSla,
  updateBoardBuySubmission,
} from "@/lib/db/boardBuy"
import { trackBoardBuyQuoteReady } from "@/lib/klaviyo/track-board-buy"
import { createServiceRoleClient } from "@/lib/supabase/server"

export async function applyOverdueBoardBuyAutoQuotes(): Promise<{ quoted: number }> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { quoted: 0 }
  }
  const now = new Date().toISOString()
  const overdue = await listSubmittedPastSla(supabase, now)
  let quoted = 0

  for (const row of overdue) {
    const offered = computeAutoOfferUsd(row.askingPrice)
    await updateBoardBuySubmission(supabase, row.id, {
      status: "auto_quoted",
      quote_source: "auto_sla",
      offered_price: offered.toFixed(2),
      quoted_at: now,
    })
    const fresh = await getBoardBuySubmissionById(supabase, row.id)
    if (fresh) {
      void trackBoardBuyQuoteReady(fresh).catch((err) => {
        console.error("[boardBuySla] klaviyo", err)
      })
    }
    quoted += 1
  }

  return { quoted }
}

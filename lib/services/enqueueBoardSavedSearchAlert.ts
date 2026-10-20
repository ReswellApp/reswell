import { send } from "@vercel/queue"
import {
  BOARD_SAVED_SEARCH_ALERT_RETENTION_SECONDS,
  BOARD_SAVED_SEARCH_ALERT_TOPIC,
} from "@/lib/services/boardSavedSearchAlertQueue"
import { notifyBoardSavedSearchMatchesForListing } from "@/lib/services/notifyBoardSavedSearchMatches"

/**
 * Publish one queue message for a listing that just went live.
 * The consumer matches saved searches. If the queue is unavailable, match once
 * inline so local dev and a queue outage still send the obvious alerts.
 */
export async function enqueueBoardSavedSearchAlert(listingId: string): Promise<void> {
  const id = listingId.trim()
  if (!id) return
  try {
    await send(
      BOARD_SAVED_SEARCH_ALERT_TOPIC,
      { listingId: id },
      {
        idempotencyKey: `board-saved-search-alert:${id}`,
        retentionSeconds: BOARD_SAVED_SEARCH_ALERT_RETENTION_SECONDS,
      },
    )
  } catch (err) {
    console.error("[saved_search] queue send failed, matching inline:", err)
    try {
      await notifyBoardSavedSearchMatchesForListing(id)
    } catch (notifyErr) {
      console.error("[saved_search] inline match failed:", notifyErr)
    }
  }
}

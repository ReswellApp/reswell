import { handleCallback } from "@vercel/queue"
import { z } from "zod"
import {
  BoardSavedSearchAlertRetryError,
  boardSavedSearchAlertRetryDecision,
} from "@/lib/services/boardSavedSearchAlertQueue"
import { notifyBoardSavedSearchMatchesForListing } from "@/lib/services/notifyBoardSavedSearchMatches"

export const maxDuration = 300

const messageSchema = z.object({
  listingId: z.string().uuid(),
})

/**
 * One newly published listing. Match saved searches now.
 * Throw when the surfboard is not in the search index yet so the queue
 * delivers this same message again for about an hour.
 */
export const POST = handleCallback(
  async (message) => {
    const parsed = messageSchema.safeParse(message)
    if (!parsed.success) {
      console.error("[saved_search] queue message ignored:", parsed.error.flatten())
      return
    }
    const result = await notifyBoardSavedSearchMatchesForListing(parsed.data.listingId)
    if (result.retry) throw new BoardSavedSearchAlertRetryError()
  },
  {
    visibilityTimeoutSeconds: 300,
    retry: (error, metadata) =>
      boardSavedSearchAlertRetryDecision({
        deliveryCount: metadata.deliveryCount,
        createdAtMs: metadata.createdAt.getTime(),
        nowMs: Date.now(),
        reason: error instanceof BoardSavedSearchAlertRetryError ? "index_pending" : "failed",
      }),
  },
)

import { z } from "zod"
import { PEER_LISTING_SECTIONS } from "@/lib/peer-listing-sections"

/**
 * Events emitted by the /sell publish funnel. Kept as closed enums so the
 * analytics queries stay stable. `listingType` reuses the peer listing section
 * vocabulary so funnel rows join cleanly against `listings.section`.
 */
export const sellFunnelEventSchema = z.object({
  listingType: z.enum(PEER_LISTING_SECTIONS),
  event: z.enum([
    "flow_started",
    "step_viewed",
    "step_completed",
    "publish_attempt",
    "validation_failed",
    "upload_failed",
    "publish_failed",
    "publish_succeeded",
  ]),
  field: z.string().trim().max(120).optional(),
  message: z.string().trim().max(500).optional(),
  listingId: z.string().uuid().optional(),
  durationMs: z.number().int().nonnegative().max(3_600_000).optional(),
})

export type SellFunnelEventInput = z.infer<typeof sellFunnelEventSchema>

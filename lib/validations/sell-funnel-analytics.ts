import { z } from "zod"

import { PEER_LISTING_SECTIONS } from "@/lib/peer-listing-sections"

export const sellFunnelAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
  listingType: z.enum(PEER_LISTING_SECTIONS).optional(),
})

export type SellFunnelAnalyticsQuery = z.infer<typeof sellFunnelAnalyticsQuerySchema>

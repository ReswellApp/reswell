import { z } from "zod"

export const adminStartMarketplaceConversationBodySchema = z.object({
  target_user_id: z.string().uuid(),
  initial_message: z.string().max(8000).optional().nullable(),
})

export const adminMarketplaceUserSearchQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

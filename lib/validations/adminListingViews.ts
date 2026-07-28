import { z } from "zod"

export const adminListingViewsQuerySchema = z.object({
  period: z.enum(["7d", "30d", "all"]).optional().default("7d"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
  userId: z.string().uuid().optional(),
  listingId: z.string().uuid().optional(),
})

export type AdminListingViewsQuery = z.infer<typeof adminListingViewsQuerySchema>

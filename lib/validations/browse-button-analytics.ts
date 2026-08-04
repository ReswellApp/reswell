import { z } from "zod"

export const browseButtonAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
})

export type BrowseButtonAnalyticsQuery = z.infer<typeof browseButtonAnalyticsQuerySchema>

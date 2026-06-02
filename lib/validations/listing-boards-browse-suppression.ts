import { z } from "zod"

export const listingBoardsBrowseSuppressionBodySchema = z.object({
  suppressed_on_boards_browse: z.boolean(),
})

export const adminBoardsBrowseSuppressedSearchQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
})

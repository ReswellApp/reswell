import { z } from "zod"
import { boardSavedSearchCriteriaSchema } from "@/lib/validations/boardSavedSearch"

/** Which no-results surface captured the demand. */
export const boardListingRequestSourceSchema = z.enum(["boards", "search"])

export type BoardListingRequestSource = z.infer<typeof boardListingRequestSourceSchema>

/** Input from the no-results "notify me when listed" capture form. */
export const createBoardListingRequestActionSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  query: z.string().trim().max(500).optional(),
  criteria: boardSavedSearchCriteriaSchema.default({}),
  source: boardListingRequestSourceSchema,
})

export type CreateBoardListingRequestActionInput = z.infer<
  typeof createBoardListingRequestActionSchema
>

/** Max demand-capture submissions accepted per email per rolling 24h window. */
export const BOARD_LISTING_REQUEST_DAILY_CAP = 20

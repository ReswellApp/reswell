import { z } from "zod"

export const listingVacationModeBodySchema = z.object({
  listingId: z.string().uuid(),
  vacationMode: z.boolean(),
})

export type ListingVacationModeInput = z.infer<typeof listingVacationModeBodySchema>

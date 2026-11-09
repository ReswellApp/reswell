import { z } from "zod"

export const listingImageRotateSchema = z.object({
  quarterTurns: z.union([z.literal(1), z.literal(2), z.literal(3)]),
})

export type ListingImageRotateInput = z.infer<typeof listingImageRotateSchema>

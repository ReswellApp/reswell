import { z } from "zod"

export const surfboardFlipperOfferSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(254),
})

export type SurfboardFlipperOfferInput = z.infer<typeof surfboardFlipperOfferSchema>

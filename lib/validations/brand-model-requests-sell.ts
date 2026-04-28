import { z } from "zod"

export const brandModelRequestSellPostBodySchema = z.object({
  brandId: z.string().uuid(),
  requestedModelName: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).optional(),
})

export type BrandModelRequestSellPostBody = z.infer<typeof brandModelRequestSellPostBodySchema>

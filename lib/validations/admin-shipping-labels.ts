import { z } from "zod"

export const adminShippingManualTrackingBodySchema = z.object({
  order_id: z.string().uuid(),
  tracking_number: z.string().min(3).max(128),
  tracking_carrier: z.string().max(128).optional(),
})

export type AdminShippingManualTrackingBody = z.infer<typeof adminShippingManualTrackingBodySchema>

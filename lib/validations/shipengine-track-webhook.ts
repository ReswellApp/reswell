import { z } from "zod"

const trackDataSchema = z
  .object({
    tracking_number: z.string().optional(),
    status_code: z.string().optional(),
    status_description: z.string().optional(),
    carrier_status_description: z.string().nullable().optional(),
    estimated_delivery_date: z.string().nullable().optional(),
    actual_delivery_date: z.string().nullable().optional(),
    exception_description: z.string().nullable().optional(),
    events: z
      .array(
        z.object({
          occurred_at: z.string().optional(),
          description: z.string().nullable().optional(),
          city_locality: z.string().nullable().optional(),
          state_province: z.string().nullable().optional(),
        }),
      )
      .optional(),
  })
  .passthrough()

export const shipEngineTrackWebhookSchema = z.object({
  resource_type: z.literal("API_TRACK"),
  resource_url: z.string().optional(),
  data: trackDataSchema.optional(),
})

export type ShipEngineTrackWebhookPayload = z.infer<typeof shipEngineTrackWebhookSchema>

import { z } from "zod"

/** Manual POST `/api/integrations/klaviyo/trigger-buyer-review-eligible` (Bearer `CRON_SECRET` when set). */
export const klaviyoTriggerBuyerReviewEligibleBodySchema = z.object({
  /** `orders.id` — event uses the real buyer profile and order payload. */
  order_id: z.string().uuid(),
  trigger: z
    .enum(["carrier_delivered", "buyer_confirmed_delivery", "pickup_complete"])
    .optional()
    .default("carrier_delivered"),
  /**
   * When true, skips delivery/review eligibility checks (template testing only).
   * Default false — production path requires a delivered/picked-up order with no buyer review.
   */
  force: z.boolean().optional().default(false),
  /**
   * Appended to Klaviyo `unique_id` so repeat test sends are not deduped.
   * Use only short alphanumeric / hyphen values.
   */
  dedupe_nonce: z
    .string()
    .max(64)
    .regex(/^[a-zA-Z0-9-]*$/)
    .optional(),
})

export type KlaviyoTriggerBuyerReviewEligibleBody = z.infer<
  typeof klaviyoTriggerBuyerReviewEligibleBodySchema
>

import { z } from "zod"

export const klaviyoAdminInactivePushBodySchema = z.object({
  user_id: z.string().uuid(),
  /** `highest_pending` = one Klaviyo event (max inactive tier they qualify for); `all_pending` = each unsent qualifying tier */
  strategy: z.enum(["highest_pending", "all_pending"]).optional().default("highest_pending"),
  /** If true, sends even when `klaviyo_inactivity_milestones` already has a row (new `unique_id`); does not duplicate DB rows */
  force: z.boolean().optional().default(false),
})

export type KlaviyoAdminInactivePushBody = z.infer<typeof klaviyoAdminInactivePushBodySchema>

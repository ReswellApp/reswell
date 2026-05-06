import { z } from "zod"

/** Manual POST `/api/integrations/klaviyo/trigger-inactive-milestone` (Bearer `CRON_SECRET` when set). */
export const klaviyoTriggerInactiveMilestoneBodySchema = z.object({
  /** Supabase `profiles.id` — event profile `external_id`. */
  user_id: z.string().uuid(),
  milestone_days: z.union([z.literal(3), z.literal(15), z.literal(30)]).optional().default(3),
  /**
   * When true, inserts `klaviyo_inactivity_milestones` so cron will not re-send this milestone.
   * Default false for safe template testing.
   */
  record_milestone: z.boolean().optional().default(false),
  /**
   * Appended to Klaviyo `unique_id` so repeat test sends are not deduped (omit to use production id).
   * Use only short alphanumeric / hyphen values.
   */
  dedupe_nonce: z
    .string()
    .max(64)
    .regex(/^[a-zA-Z0-9-]*$/)
    .optional(),
})

export type KlaviyoTriggerInactiveMilestoneBody = z.infer<
  typeof klaviyoTriggerInactiveMilestoneBodySchema
>

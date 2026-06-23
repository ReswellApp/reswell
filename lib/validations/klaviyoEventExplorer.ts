import { z } from "zod"
import { isNotificationsCenterRange } from "@/lib/db/klaviyoEventLog"

export const klaviyoEventStatusFilterSchema = z.enum(["all", "sent", "skipped", "failed"])

export const klaviyoEventExplorerQuerySchema = z.object({
  range: z
    .string()
    .optional()
    .transform((v) => (isNotificationsCenterRange(v) ? v : "7d")),
  metric: z.string().trim().optional(),
  status: klaviyoEventStatusFilterSchema.optional().default("all"),
  /** Matches profile_email (partial) or profile_external_id (exact). */
  recipient: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

export type KlaviyoEventExplorerQuery = z.infer<typeof klaviyoEventExplorerQuerySchema>
export type KlaviyoEventStatusFilter = z.infer<typeof klaviyoEventStatusFilterSchema>

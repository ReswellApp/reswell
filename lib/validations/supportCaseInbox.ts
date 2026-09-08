import { z } from "zod"
import type { SupportCaseStatus } from "@/lib/types/supportCase"

export const supportCaseInboxStatusSchema = z.enum([
  "submitted",
  "in_review",
  "in_progress",
  "waiting_on_you",
  "resolved",
])

export const updateSupportCaseInboxSchema = z.object({
  case_id: z.string().uuid(),
  status: supportCaseInboxStatusSchema.optional(),
  internal_notes: z.string().max(20000).nullable().optional(),
  outcome: z.string().max(40).nullable().optional(),
})

export type UpdateSupportCaseInboxInput = z.infer<typeof updateSupportCaseInboxSchema>
export type SupportCaseInboxStatus = SupportCaseStatus

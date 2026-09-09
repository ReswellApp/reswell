import { z } from "zod"
import type { SupportCaseStatus } from "@/lib/types/supportCase"

export const supportCaseInboxStatusSchema = z.enum([
  "submitted",
  "in_review",
  "in_progress",
  "waiting_on_you",
  "resolved",
])

export const supportCaseOutcomeSchema = z.enum([
  "approved",
  "partial",
  "denied",
  "withdrawn",
  "cancelled",
  "informed",
])

export const updateSupportCaseInboxSchema = z.object({
  case_id: z.string().uuid(),
  status: supportCaseInboxStatusSchema.optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  internal_notes: z.string().max(20000).nullable().optional(),
  outcome: supportCaseOutcomeSchema.nullable().optional(),
})

export type UpdateSupportCaseInboxInput = z.infer<typeof updateSupportCaseInboxSchema>
export type SupportCaseInboxStatus = SupportCaseStatus

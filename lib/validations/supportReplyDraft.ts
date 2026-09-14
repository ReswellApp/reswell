import { z } from "zod"

export const SUPPORT_REPLY_DRAFT_RATINGS = ["accepted", "edited", "rejected"] as const
export const SUPPORT_REPLY_DRAFT_ORIGINS = ["llm", "example", "macro"] as const

export const supportReplyDraftCaseIdSchema = z.object({
  case_id: z.string().uuid(),
  force: z.boolean().optional(),
})

export const supportReplyDraftFeedbackSchema = z.object({
  case_id: z.string().uuid(),
  draft_id: z.string().uuid().optional(),
  rating: z.enum(SUPPORT_REPLY_DRAFT_RATINGS),
  sent_body: z.string().trim().max(12000).optional(),
})

export const supportReplyDraftLlmSchema = z.object({
  reply: z.string().trim().min(1).max(12000),
  cited_help_slugs: z.array(z.string().trim().min(1).max(160)).max(8),
  needs_human_review: z.boolean(),
})

export type SupportReplyDraftRating = z.infer<typeof supportReplyDraftFeedbackSchema>["rating"]
export type SupportReplyDraftOrigin = (typeof SUPPORT_REPLY_DRAFT_ORIGINS)[number]
export type SupportReplyDraftLlmOutput = z.infer<typeof supportReplyDraftLlmSchema>
export type SupportReplyDraftCaseInput = z.infer<typeof supportReplyDraftCaseIdSchema>
export type SupportReplyDraftFeedbackInput = z.infer<typeof supportReplyDraftFeedbackSchema>

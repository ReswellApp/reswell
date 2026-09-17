import { z } from "zod"

export const SUPPORT_REPLY_DRAFT_RATINGS = ["very_good", "okay", "bad"] as const

const SUPPORT_REPLY_DRAFT_RATING_BY_ALIAS: Record<string, (typeof SUPPORT_REPLY_DRAFT_RATINGS)[number]> =
  {
    very_good: "very_good",
    okay: "okay",
    bad: "bad",
    accepted: "very_good",
    edited: "okay",
    rejected: "bad",
  }

export function normalizeSupportReplyDraftRating(
  value: unknown,
): (typeof SUPPORT_REPLY_DRAFT_RATINGS)[number] | null {
  if (typeof value !== "string") return null
  return SUPPORT_REPLY_DRAFT_RATING_BY_ALIAS[value] ?? null
}

/** Edited sends are okay and still teach later drafts. Unchanged or freehand sends are very good. */
export function supportReplyRatingForSentBody(
  draftBody: string | null | undefined,
  sentBody: string,
): (typeof SUPPORT_REPLY_DRAFT_RATINGS)[number] {
  const draft = draftBody?.trim() ?? ""
  const sent = sentBody.trim()
  if (draft && draft !== sent) return "okay"
  return "very_good"
}

const supportReplyDraftRatingSchema = z.preprocess(
  (value) => normalizeSupportReplyDraftRating(value) ?? value,
  z.enum(SUPPORT_REPLY_DRAFT_RATINGS),
)
export const SUPPORT_REPLY_DRAFT_ORIGINS = ["llm", "example", "macro"] as const
export const SUPPORT_REPLY_EXAMPLE_KINDS = [
  "general",
  "order_question",
  "cancel_request",
  "protection_claim",
  "safety",
  "payments",
  "account",
] as const
export const SUPPORT_REPLY_EXAMPLE_PAGE_SIZE = 25
export const SUPPORT_REPLY_EXAMPLE_SEARCH_MAX = 200

const emptyToUndefined = (value: unknown) => {
  if (value == null) return undefined
  if (typeof value === "string" && value.trim() === "") return undefined
  if (Array.isArray(value)) return value[0]
  return value
}

const citedHelpSlugsSchema = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => {
    const parts = Array.isArray(value) ? value : value.split(/[\n,]+/)
    return [...new Set(parts.map((part) => part.trim()).filter(Boolean))].slice(0, 8)
  })
  .pipe(z.array(z.string().trim().min(1).max(160)).max(8))

const optionalKindSchema = z.preprocess(
  emptyToUndefined,
  z.enum(SUPPORT_REPLY_EXAMPLE_KINDS).optional().catch(undefined),
)

const optionalRatingSchema = z.preprocess((value) => {
  const raw = emptyToUndefined(value)
  if (raw == null) return undefined
  return normalizeSupportReplyDraftRating(raw) ?? raw
}, z.enum(SUPPORT_REPLY_DRAFT_RATINGS).optional().catch(undefined))

const optionalQuerySchema = z
  .preprocess(emptyToUndefined, z.string().optional().catch(undefined))
  .transform((value) => {
    if (typeof value !== "string") return undefined
    const trimmed = value.trim()
    if (!trimmed) return undefined
    return trimmed.slice(0, SUPPORT_REPLY_EXAMPLE_SEARCH_MAX)
  })

const optionalPageSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).optional().catch(undefined),
)

const optionalLimitSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).max(100).optional().catch(undefined),
)

export const SUPPORT_REPLY_ROOT_PROMPT_MAX = 8000
export const SUPPORT_REPLY_REWRITE_INSTRUCTION_MAX = 2000

export const supportReplyDraftCaseIdSchema = z.object({
  case_id: z.string().uuid(),
  force: z.boolean().optional(),
  peek: z.boolean().optional(),
  rewrite_instruction: z.string().trim().max(SUPPORT_REPLY_REWRITE_INSTRUCTION_MAX).optional(),
  current_draft: z.string().trim().max(12000).optional(),
})

export const supportReplyRootPromptSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write the root prompt the agent should follow.")
    .max(SUPPORT_REPLY_ROOT_PROMPT_MAX),
})

export const supportReplyDraftFeedbackSchema = z.object({
  case_id: z.string().uuid(),
  draft_id: z.string().uuid().optional(),
  rating: supportReplyDraftRatingSchema,
  sent_body: z.string().trim().max(12000).optional(),
})

export const supportReplyDraftLlmSchema = z.object({
  reply: z.string().trim().min(1).max(12000),
  cited_help_slugs: z.array(z.string().trim().min(1).max(160)).max(8),
  needs_human_review: z.boolean(),
})

export const csAgentLlmSchema = supportReplyDraftLlmSchema.extend({
  reason: z.string().trim().max(280),
  cited_order_refs: z.array(z.string().trim().min(1).max(80)).max(8),
  cited_ticket_ids: z.array(z.string().uuid()).max(8),
  close_ticket: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "True only for live chat when the visitor's issue is fully solved and this ticket should resolve. False if you asked a question, need more info, or the issue is still open.",
    ),
})

export const supportReplyExampleListSchema = z.object({
  rating: optionalRatingSchema,
  kind: optionalKindSchema,
  q: optionalQuerySchema,
  page: optionalPageSchema,
  limit: optionalLimitSchema,
})

export const supportReplyExampleUpdateSchema = z.object({
  id: z.string().uuid(),
  customer_excerpt: z.string().trim().min(1, "Customer excerpt is required.").max(4000),
  staff_reply: z.string().trim().min(1, "Staff reply is required.").max(12000),
  rating: supportReplyDraftRatingSchema,
  kind: z
    .union([z.enum(SUPPORT_REPLY_EXAMPLE_KINDS), z.literal(""), z.null()])
    .transform((value) => (value === "" || value == null ? null : value)),
  cited_help_slugs: citedHelpSlugsSchema,
})

export const supportReplyExampleDeleteSchema = z.object({
  id: z.string().uuid(),
})

export type SupportReplyDraftRating = z.infer<typeof supportReplyDraftFeedbackSchema>["rating"]
export type SupportReplyDraftOrigin = (typeof SUPPORT_REPLY_DRAFT_ORIGINS)[number]
export type SupportReplyDraftLlmOutput = z.infer<typeof supportReplyDraftLlmSchema>
export type CsAgentLlmOutput = z.infer<typeof csAgentLlmSchema>
export type SupportReplyDraftCaseInput = z.infer<typeof supportReplyDraftCaseIdSchema>
export type SupportReplyDraftFeedbackInput = z.infer<typeof supportReplyDraftFeedbackSchema>
export type SupportReplyExampleKind = (typeof SUPPORT_REPLY_EXAMPLE_KINDS)[number]
export type SupportReplyExampleListInput = z.infer<typeof supportReplyExampleListSchema>
export type SupportReplyExampleUpdateInput = z.infer<typeof supportReplyExampleUpdateSchema>
export type SupportReplyExampleDeleteInput = z.infer<typeof supportReplyExampleDeleteSchema>
export type SupportReplyRootPromptInput = z.infer<typeof supportReplyRootPromptSchema>

export function parseSupportReplyExampleListParams(raw: unknown): SupportReplyExampleListInput {
  const parsed = supportReplyExampleListSchema.safeParse(raw)
  return parsed.success ? parsed.data : {}
}

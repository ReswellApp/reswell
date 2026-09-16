import { z } from "zod"

export const messageFraudReviewDecisionSchema = z.enum(["block", "allow"])

export const messageFraudReviewConfidenceSchema = z.enum(["high", "medium", "low"])

export const messageFraudLlmReviewStatusSchema = z.enum([
  "pending",
  "confirmed",
  "dismissed",
  "unavailable",
])

export type MessageFraudLlmReviewStatus = z.infer<typeof messageFraudLlmReviewStatusSchema>

export const messageFraudReviewSourceSchema = z.enum(["send", "batch"])

export type MessageFraudReviewSource = z.infer<typeof messageFraudReviewSourceSchema>

/**
 * Structured Gemini verdict for a marketplace DM that regex/heuristics already
 * treated as possible fraud. Keep the shape tiny so the send-path call stays fast.
 */
export const messageFraudReviewResultSchema = z.object({
  decision: messageFraudReviewDecisionSchema.describe(
    "block = do not deliver. allow = innocent wording, not an off-platform contact/payment request.",
  ),
  reason_code: z
    .enum([
      "phone_like",
      "phone_fragment",
      "email_like",
      "off_platform_payment",
      "phishing_like",
      "external_link",
    ])
    .nullable()
    .describe("Required when decision is block. Null when allowing."),
  confidence: messageFraudReviewConfidenceSchema,
  rationale: z
    .string()
    .trim()
    .max(240)
    .describe("One short sentence. Do not repeat the user message."),
})

export type MessageFraudReviewResult = z.infer<typeof messageFraudReviewResultSchema>

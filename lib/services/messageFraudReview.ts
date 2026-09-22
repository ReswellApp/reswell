/**
 * Fast Gemini review for marketplace DMs that regex already flagged, or that
 * look like contact/payment evasion. Not called on ordinary chat.
 */

import { generateText, Output } from "ai"
import type { MessagePolicyHeuristic } from "@/lib/messages/message-fraud-fail-policy"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import {
  messageFraudReviewResultSchema,
  type MessageFraudReviewResult,
} from "@/lib/validations/message-fraud-review"

const DEFAULT_SEND_TIMEOUT_MS = 800
export const MESSAGE_FRAUD_REVIEW_BATCH_TIMEOUT_MS = 4000
const MAX_MESSAGE_CHARS = 1200
const MAX_PRIOR_MESSAGES = 6
const MAX_PRIOR_CHARS = 240

function fraudReviewFeature() {
  const feature = APP_LLM_FEATURES.find((f) => f.id === "message_fraud_review")
  if (!feature) {
    throw new Error("message_fraud_review is missing from APP_LLM_FEATURES")
  }
  return feature
}

export function isMessageFraudReviewEnabled(): boolean {
  return isAppLlmFeatureEnabled(fraudReviewFeature())
}

export function messageFraudReviewSendTimeoutMs(): number {
  const raw = process.env.MESSAGE_FRAUD_REVIEW_TIMEOUT_MS?.trim()
  if (!raw) return DEFAULT_SEND_TIMEOUT_MS
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 200) return DEFAULT_SEND_TIMEOUT_MS
  return Math.min(Math.floor(n), 2500)
}

function clip(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

const SYSTEM_PROMPT = `You review Reswell marketplace DMs for fraud / policy evasion.
Reswell is an in-app surf marketplace. Buyers and sellers must keep payment on Reswell. No emails, Venmo, Zelle, PayPal, Cash App, Apple Cash, Western Union, wires, or asking to pay off-platform.

Phone numbers are allowed for now. Do not block a message because it shares a phone number, asks for a phone number, or says to text, call, or WhatsApp. Do not use phone_like or phone_fragment.

BLOCK when the message (or the recent sender messages together) does any of these:
- Asks for or offers Venmo, Zelle, PayPal, Cash App, Apple Cash, Western Union, MoneyGram, wire, $cashapp handles, leetspeak (v3nmo, z3lle), or spaced letters (v e n m o).
- Phishing / fake Reswell support, verify-account links, payout portals.
- Shares an email address.

ALLOW when a flagged word is used innocently:
- “Cash pickup”, “pay in cash locally”, “cash on pickup” as an in-person meetup — not “send me cash” / “cash first then I ship”.
- Board dimensions, prices, years, zip codes, order numbers, and phone numbers.
- Someone refusing off-platform pay (“don’t Venmo me, use Reswell checkout”).
- Talking about the policy itself.
- Sharing or asking for a phone number, including spelled digits and numbers split across messages.

If it is a real off-platform payment request, BLOCK even when they try to hide it.
If the only hit is a phone number or a fraud word used in a normal marketplace way, ALLOW.
When decision is allow, reason_code must be null.
When decision is block, reason_code must be one of: email_like, off_platform_payment, phishing_like, external_link.
One short rationale. Do not invent extra policy.`

export async function reviewMarketplaceMessageForFraud(input: {
  text: string
  heuristic: MessagePolicyHeuristic
  priorSenderMessages?: string[]
  timeoutMs?: number
}): Promise<MessageFraudReviewResult | null> {
  if (!isMessageFraudReviewEnabled()) return null

  const text = clip(input.text, MAX_MESSAGE_CHARS)
  if (!text) return null

  const feature = fraudReviewFeature()
  const timeoutMs = input.timeoutMs ?? messageFraudReviewSendTimeoutMs()
  const prior = (input.priorSenderMessages ?? [])
    .map((row) => clip(row, MAX_PRIOR_CHARS))
    .filter(Boolean)
    .slice(-MAX_PRIOR_MESSAGES)

  const priorBlock =
    prior.length > 0
      ? `\nRecent messages from this sender (oldest first):\n${prior.map((row) => `- ${row}`).join("\n")}`
      : ""

  try {
    const { output } = await generateText({
      model: resolveConfiguredModel(feature),
      output: Output.object({ schema: messageFraudReviewResultSchema }),
      system: SYSTEM_PROMPT,
      prompt: `Heuristic flag: ${input.heuristic}
Message:
"""${text}"""${priorBlock}

Classify block or allow.`,
      temperature: 0,
      maxOutputTokens: 180,
      maxRetries: 0,
      timeout: timeoutMs,
      providerOptions: {
        gateway: {
          tags: gatewayTagsForFeature("message_fraud_review"),
        },
      },
    })

    if (!output) return null
    return messageFraudReviewResultSchema.parse(output)
  } catch (err) {
    console.error("[messageFraudReview] LLM failed:", err)
    return null
  }
}


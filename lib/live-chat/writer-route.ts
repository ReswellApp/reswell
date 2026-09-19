/**
 * Live-chat writer roster Jev routes between.
 * Jev never writes the customer-facing reply — it only picks a key.
 */

export const LIVE_CHAT_WRITER_IDS = ["flash_lite", "flash", "pro"] as const
export type LiveChatWriterId = (typeof LIVE_CHAT_WRITER_IDS)[number]

export const LIVE_CHAT_WRITER_FALLBACK: LiveChatWriterId = "pro"

export const LIVE_CHAT_DEFAULT_WRITER_MODELS: Record<LiveChatWriterId, string> = {
  flash_lite: "google/gemini-2.5-flash-lite",
  flash: "google/gemini-2.5-flash",
  pro: "google/gemini-2.5-pro",
}

export const LIVE_CHAT_WRITER_MODEL_ENV: Record<LiveChatWriterId, string> = {
  flash_lite: "LIVE_CHAT_WRITER_FLASH_LITE_MODEL",
  flash: "LIVE_CHAT_WRITER_FLASH_MODEL",
  pro: "LIVE_CHAT_WRITER_PRO_MODEL",
}

export const LIVE_CHAT_JEV_GATEWAY_MODEL = "typesafe-ai/jev"

export function parseLiveChatWriterId(value: unknown): LiveChatWriterId | null {
  if (value === "flash_lite" || value === "flash" || value === "pro") return value
  return null
}

export function liveChatWriterModelId(
  writer: LiveChatWriterId,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const envName = LIVE_CHAT_WRITER_MODEL_ENV[writer]
  const override = env[envName]?.trim()
  if (override) return override
  return LIVE_CHAT_DEFAULT_WRITER_MODELS[writer]
}

/**
 * CS agent generate uses tools + `Output.object`. Gemini 2.5 Flash Lite
 * returns AI_NoOutputGeneratedError on that harness (prod 2026-09-19).
 * Keep flash_lite as a Jev key, but write with flash.
 */
export function liveChatCsAgentWriterId(writer: LiveChatWriterId): LiveChatWriterId {
  return writer === "flash_lite" ? "flash" : writer
}

export function liveChatCsAgentWriterModel(
  writer: LiveChatWriterId,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return liveChatWriterModelId(liveChatCsAgentWriterId(writer), env)
}

export const LIVE_CHAT_JEV_WRITER_CRITERIA = {
  flash_lite:
    "Greeting (hi, hey, hello, hi there), thanks, okay/got it, or other social filler with no Reswell product, policy, or account question. Routing only — the chat still sends a short human hello; do not stay silent.",
  flash:
    "How-to or published policy that Help Center already answers: buying a board, selling, marketplace fees, how sellers get paid / cash out, Purchase Protection coverage, shipping rules, sign-in/account basics. Generic payout how-tos belong here. No specific order number, tracking, this-sale payout status, label, refund, or claim fact is required.",
  pro:
    "Needs this visitor's order, tracking, payout status/amount/hold, label, refund, Purchase Protection claim, or the ask is ambiguous and could invent a status if a weaker model guesses. Generic how-tos (including how sellers get paid) are flash, not pro.",
} as const

export const LIVE_CHAT_JEV_WRITER_INSTRUCTIONS =
  "Pick the chat model that should write the customer-facing live-chat reply. You are routing only. Do not write the reply."

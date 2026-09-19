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

export const LIVE_CHAT_JEV_WRITER_CRITERIA = {
  flash_lite:
    "Greeting, thanks, okay/got it, or other social filler with no Reswell product, policy, or account question.",
  flash:
    "How-to or published policy that Help Center already answers: buying a board, selling, marketplace fees, Purchase Protection coverage, shipping rules, sign-in/account basics. No specific order number, tracking, payout, label, refund, or claim fact is required.",
  pro:
    "Needs this visitor's order, tracking, payout, label, refund, Purchase Protection claim, or the ask is ambiguous, money-adjacent, or could invent a status if a weaker model guesses.",
} as const

export const LIVE_CHAT_JEV_WRITER_INSTRUCTIONS =
  "Pick the chat model that should write the customer-facing live-chat reply. You are routing only. Do not write the reply."

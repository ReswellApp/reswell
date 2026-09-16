export const LIVE_CHAT_TEAM_NAME = "Reswell Team"

export function liveChatAgentDisplayName(args: {
  senderType: "visitor" | "agent" | "system" | "bot"
  senderAgentId?: string | null
  lookedUpName?: string | null
}): string | null {
  if (args.senderType === "bot") return LIVE_CHAT_TEAM_NAME
  if (args.senderType !== "agent") return null
  if (args.senderAgentId) return args.lookedUpName?.trim() || "Support"
  return LIVE_CHAT_TEAM_NAME
}

/** Old bot-handoff / wait-for-human copy that must not stay in the widget. */
export function isLegacyLiveChatWidgetCopy(content: string): boolean {
  const text = content.toLowerCase()
  return (
    text.includes("asked for a human teammate") ||
    text.includes("wait for a human") ||
    text.includes("chat session not found") ||
    text.includes("we've opened a support case")
  )
}

export function liveChatCaseAlreadyHasVisitorTurn(
  messages: Array<{ author_role: string; body: string }>,
  content: string,
): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  return messages.some((message) => {
    if (message.author_role !== "customer") return false
    const body = message.body.trim()
    return body === trimmed || body.includes(`Member: ${trimmed}`)
  })
}

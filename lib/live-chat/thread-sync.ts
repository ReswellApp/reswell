export type LiveChatConversationalSender = "visitor" | "agent" | "bot"

export function latestConversationalSender(
  messages: Array<{ sender_type: "visitor" | "agent" | "system" | "bot" }>,
): LiveChatConversationalSender | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (!message || message.sender_type === "system") continue
    return message.sender_type
  }
  return null
}

export function latestConversationalIsTeam(
  messages: Array<{ sender_type: "visitor" | "agent" | "system" | "bot" }>,
): boolean {
  const sender = latestConversationalSender(messages)
  return sender === "agent" || sender === "bot"
}

export function latestConversationalIsVisitor(
  messages: Array<{ sender_type: "visitor" | "agent" | "system" | "bot" }>,
): boolean {
  return latestConversationalSender(messages) === "visitor"
}

/** Latest auto-sent Hayden/David bubble — only this one can be re-rolled. */
export function latestLiveChatAutoReplyId(
  messages: Array<{
    id: string
    sender_type: "visitor" | "agent" | "system" | "bot"
    sender_agent_id?: string | null
  }>,
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (!message || message.sender_type === "system") continue
    if (message.sender_type === "agent" && !message.sender_agent_id) return message.id
    return null
  }
  return null
}

export function latestLiveChatVisitorContent(
  messages: Array<{ sender_type: "visitor" | "agent" | "system" | "bot"; content: string }>,
): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message?.sender_type === "visitor" && message.content.trim()) {
      return message.content.trim()
    }
  }
  return ""
}

export function isLatestLiveChatAutoReply(
  messages: Array<{
    id: string
    sender_type: "visitor" | "agent" | "system" | "bot"
    sender_agent_id?: string | null
  }>,
  messageId: string,
): boolean {
  return latestLiveChatAutoReplyId(messages) === messageId
}

export function hasTeamReplySince(
  messages: Array<{
    sender_type: "visitor" | "agent" | "system" | "bot"
    created_at: string
  }>,
  sinceIso: string,
): boolean {
  const since = new Date(sinceIso).getTime() - 250
  return messages.some((message) => {
    if (message.sender_type !== "agent" && message.sender_type !== "bot") return false
    return new Date(message.created_at).getTime() >= since
  })
}

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

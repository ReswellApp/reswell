export const LIVE_CHAT_AGENTS_PRESENCE_CHANNEL = "live-chat:agents"

export function liveChatSessionChannel(sessionId: string): string {
  return `live-chat:session:${sessionId}`
}

export type LiveChatBroadcastMessage = {
  type: "message"
  message: {
    id: string
    session_id: string
    sender_type: "visitor" | "agent" | "system"
    sender_agent_id: string | null
    content: string
    created_at: string
    agent_display_name?: string | null
  }
}

export type LiveChatBroadcastTyping = {
  type: "typing"
  participant_type: "visitor" | "agent"
  display_name: string
  is_typing: boolean
}

export type LiveChatBroadcastEvent = LiveChatBroadcastMessage | LiveChatBroadcastTyping

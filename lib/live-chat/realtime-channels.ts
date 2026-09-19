export const LIVE_CHAT_AGENTS_PRESENCE_CHANNEL = "live-chat:agents"
export const LIVE_CHAT_BROADCAST_EVENT = "live_chat"

export function liveChatSessionChannel(sessionId: string): string {
  return `live-chat:session:${sessionId}`
}

export type LiveChatBroadcastMessage = {
  type: "message"
  message: {
    id: string
    session_id: string
    sender_type: "visitor" | "agent" | "system" | "bot"
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

export type LiveChatBroadcastSession = {
  type: "session"
  status: "resolved" | "closed"
}

export type LiveChatBroadcastEvent =
  | LiveChatBroadcastMessage
  | LiveChatBroadcastTyping
  | LiveChatBroadcastSession

/** REST body for serverless broadcast — avoids opening a websocket from Vercel `after()`. */
export function liveChatBroadcastHttpRequest(args: {
  supabaseUrl: string
  sessionId: string
  payload: LiveChatBroadcastEvent
}): {
  url: string
  body: {
    messages: Array<{
      topic: string
      event: string
      payload: LiveChatBroadcastEvent
      private: false
    }>
  }
} {
  return {
    url: `${args.supabaseUrl.replace(/\/$/, "")}/realtime/v1/api/broadcast`,
    body: {
      messages: [
        {
          topic: liveChatSessionChannel(args.sessionId),
          event: LIVE_CHAT_BROADCAST_EVENT,
          payload: args.payload,
          private: false,
        },
      ],
    },
  }
}

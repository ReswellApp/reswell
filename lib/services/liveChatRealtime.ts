import {
  liveChatBroadcastHttpRequest,
  type LiveChatBroadcastEvent,
  type LiveChatBroadcastMessage,
} from "@/lib/live-chat/realtime-channels"

async function publishLiveChatEvent(
  sessionId: string,
  payload: LiveChatBroadcastEvent,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error("publishLiveChatEvent missing supabase env", { sessionId })
    return
  }

  const request = liveChatBroadcastHttpRequest({
    supabaseUrl,
    sessionId,
    payload,
  })

  try {
    const res = await fetch(request.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(request.body),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error("publishLiveChatEvent http", {
        sessionId,
        status: res.status,
        detail: detail.slice(0, 300),
      })
    }
  } catch (error) {
    console.error("publishLiveChatEvent", { sessionId, error })
  }
}

export async function broadcastLiveChatMessage(args: {
  sessionId: string
  message: LiveChatBroadcastMessage["message"]
}): Promise<void> {
  await publishLiveChatEvent(args.sessionId, {
    type: "message",
    message: args.message,
  })
}

export async function broadcastLiveChatTyping(args: {
  sessionId: string
  participantType: "visitor" | "agent"
  displayName: string
  isTyping: boolean
}): Promise<void> {
  await publishLiveChatEvent(args.sessionId, {
    type: "typing",
    participant_type: args.participantType,
    display_name: args.displayName,
    is_typing: args.isTyping,
  })
}

export async function broadcastLiveChatSessionStatus(args: {
  sessionId: string
  status: "resolved" | "closed"
}): Promise<void> {
  await publishLiveChatEvent(args.sessionId, {
    type: "session",
    status: args.status,
  })
}

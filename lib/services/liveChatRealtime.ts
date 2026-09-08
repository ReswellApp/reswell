import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  liveChatSessionChannel,
  type LiveChatBroadcastEvent,
  type LiveChatBroadcastMessage,
} from "@/lib/live-chat/realtime-channels"

async function publishLiveChatEvent(
  sessionId: string,
  payload: LiveChatBroadcastEvent,
): Promise<void> {
  const supabase = createServiceRoleClient()
  const channel = supabase.channel(liveChatSessionChannel(sessionId), {
    config: { broadcast: { ack: false } },
  })
  try {
    const status = await new Promise<string>((resolve) => {
      void channel.subscribe((next) => {
        if (next === "SUBSCRIBED" || next === "CHANNEL_ERROR" || next === "TIMED_OUT") {
          resolve(next)
        }
      })
    })
    if (status !== "SUBSCRIBED") return
    await channel.send({
      type: "broadcast",
      event: "live_chat",
      payload,
    })
  } catch (error) {
    console.error("publishLiveChatEvent", { sessionId, error })
  } finally {
    void supabase.removeChannel(channel)
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

"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { LIVE_CHAT_AGENTS_PRESENCE_CHANNEL } from "@/lib/live-chat/realtime-channels"

export type LiveChatAgentPresence = {
  userId: string
  displayName: string
}

type PresencePayload = {
  userId: string
  displayName: string
}

function parseAgentPresence(state: Record<string, PresencePayload[]>): LiveChatAgentPresence[] {
  const agents: LiveChatAgentPresence[] = []
  for (const payloads of Object.values(state)) {
    const latest = payloads[payloads.length - 1]
    if (!latest?.userId) continue
    agents.push({
      userId: latest.userId,
      displayName: latest.displayName?.trim() || "Support",
    })
  }
  return agents
}

export function useLiveChatAgentPresence(
  userId: string | null,
  displayName: string | null,
  enabled: boolean,
) {
  const supabase = useMemo(() => createClient(), [])
  const [agentsOnline, setAgentsOnline] = useState<LiveChatAgentPresence[]>([])

  useEffect(() => {
    if (!enabled || !userId) {
      setAgentsOnline([])
      return
    }

    const channel = supabase.channel(LIVE_CHAT_AGENTS_PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    })

    channel.on("presence", { event: "sync" }, () => {
      setAgentsOnline(parseAgentPresence(channel.presenceState() as Record<string, PresencePayload[]>))
    })

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return
      await channel.track({
        userId,
        displayName: displayName?.trim() || "Support",
      })
    })

    return () => {
      void channel.untrack()
      void supabase.removeChannel(channel)
    }
  }, [displayName, enabled, supabase, userId])

  return { agentsOnline, isAnyoneOnline: agentsOnline.length > 0 }
}

/** Visitor-side: subscribe to agent presence without tracking. */
export function useLiveChatSupportOnlineStatus(enabled: boolean) {
  const supabase = useMemo(() => createClient(), [])
  const [onlineCount, setOnlineCount] = useState(0)

  useEffect(() => {
    if (!enabled) return

    const channel = supabase.channel(LIVE_CHAT_AGENTS_PRESENCE_CHANNEL)

    channel.on("presence", { event: "sync" }, () => {
      setOnlineCount(parseAgentPresence(channel.presenceState() as Record<string, PresencePayload[]>).length)
    })

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, supabase])

  return { isSupportOnline: onlineCount > 0, onlineCount }
}

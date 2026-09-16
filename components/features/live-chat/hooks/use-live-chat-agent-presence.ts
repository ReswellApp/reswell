"use client"

import { useEffect, useState } from "react"
import {
  heartbeatLiveChatAgentPresenceAction,
  listOnlineLiveChatAgentsAction,
} from "@/lib/actions/liveChatAdmin"

export type LiveChatAgentPresence = {
  userId: string
  displayName: string
}

const HEARTBEAT_MS = 20_000
const POLL_MS = 20_000

/** Staff desk: heartbeat so visitors see a real online signal, plus other agents in the queue. */
export function useLiveChatAgentPresence(
  userId: string | null,
  displayName: string | null,
  enabled: boolean,
) {
  const [agentsOnline, setAgentsOnline] = useState<LiveChatAgentPresence[]>([])

  useEffect(() => {
    if (!enabled || !userId) {
      setAgentsOnline([])
      return
    }

    let cancelled = false

    async function pulse() {
      await heartbeatLiveChatAgentPresenceAction()
      const result = await listOnlineLiveChatAgentsAction()
      if (cancelled) return
      if ("success" in result && result.success) {
        setAgentsOnline(result.agents)
        return
      }
      if (userId && displayName) {
        setAgentsOnline([{ userId, displayName }])
      }
    }

    void pulse()
    const interval = setInterval(() => {
      void pulse()
    }, HEARTBEAT_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [displayName, enabled, userId])

  return { agentsOnline, isAnyoneOnline: agentsOnline.length > 0 }
}

type SupportTeamPayload = {
  members?: unknown
  agents_online?: boolean
  agents_online_count?: number
}

/** Visitor-side: staff heartbeat count from the API, not a public presence channel. */
export function useLiveChatSupportOnlineStatus(enabled: boolean) {
  const [onlineCount, setOnlineCount] = useState(0)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function refresh() {
      try {
        const res = await fetch("/api/live-chat/support-team")
        const json = (await res.json()) as { data?: SupportTeamPayload | unknown[] }
        if (cancelled || !json.data || Array.isArray(json.data)) return
        const count =
          typeof json.data.agents_online_count === "number"
            ? json.data.agents_online_count
            : json.data.agents_online
              ? 1
              : 0
        setOnlineCount(count)
      } catch {
        /* keep last known */
      }
    }

    void refresh()
    const interval = setInterval(() => {
      void refresh()
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [enabled])

  return { isSupportOnline: onlineCount > 0, onlineCount }
}

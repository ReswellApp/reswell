"use client"

import { useEffect, useState } from "react"
import { LIVE_CHAT_SUPPORT_LEAD_FALLBACK } from "@/lib/live-chat/support-lead-display"
import type { LiveChatSupportTeamMember } from "@/lib/services/liveChatSupportTeamDisplay"

const POLL_MS = 20_000

type SupportTeamPayload = {
  members?: LiveChatSupportTeamMember[]
  agents_online?: boolean
  agents_online_count?: number
  online_member_ids?: string[]
}

export function useLiveChatSupportLead(enabled: boolean): LiveChatSupportTeamMember {
  const { lead } = useLiveChatSupportTeam(enabled)
  return lead
}

/** Staff faces + who is currently on the desk. Polls while the widget is open. */
export function useLiveChatSupportTeam(enabled: boolean): {
  lead: LiveChatSupportTeamMember
  members: LiveChatSupportTeamMember[]
  onlineMemberIds: string[]
  isSupportOnline: boolean
} {
  const [lead, setLead] = useState<LiveChatSupportTeamMember>(LIVE_CHAT_SUPPORT_LEAD_FALLBACK)
  const [members, setMembers] = useState<LiveChatSupportTeamMember[]>([
    LIVE_CHAT_SUPPORT_LEAD_FALLBACK,
  ])
  const [onlineMemberIds, setOnlineMemberIds] = useState<string[]>([])
  const [isSupportOnline, setIsSupportOnline] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function refresh() {
      try {
        const res = await fetch("/api/live-chat/support-team")
        const json = (await res.json()) as {
          data?: SupportTeamPayload | LiveChatSupportTeamMember[]
        }
        if (cancelled || !json.data) return

        const payload = Array.isArray(json.data) ? { members: json.data } : json.data
        const nextMembers = payload.members?.filter(Boolean) ?? []
        if (nextMembers[0]) {
          setLead(nextMembers[0])
          setMembers(nextMembers)
        }
        const ids = payload.online_member_ids ?? []
        setOnlineMemberIds(ids)
        setIsSupportOnline(
          ids.length > 0 ||
            payload.agents_online === true ||
            (payload.agents_online_count ?? 0) > 0,
        )
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

  return { lead, members, onlineMemberIds, isSupportOnline }
}

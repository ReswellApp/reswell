"use client"

import { useEffect, useState } from "react"
import { LIVE_CHAT_SUPPORT_LEAD_FALLBACK } from "@/lib/live-chat/support-lead-display"
import type { LiveChatSupportTeamMember } from "@/lib/services/liveChatSupportTeamDisplay"

export function useLiveChatSupportLead(enabled: boolean): LiveChatSupportTeamMember {
  const [lead, setLead] = useState<LiveChatSupportTeamMember>(LIVE_CHAT_SUPPORT_LEAD_FALLBACK)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    void fetch("/api/live-chat/support-team")
      .then((res) => res.json())
      .then((json: { data?: LiveChatSupportTeamMember[] }) => {
        if (cancelled || !json.data?.[0]) return
        setLead(json.data[0])
      })
      .catch(() => {
        /* keep fallback */
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return lead
}

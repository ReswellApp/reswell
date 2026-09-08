"use client"

import { LiveChatSupportLeadAvatar } from "@/components/features/live-chat/live-chat-support-lead-avatar"
import {
  LIVE_CHAT_SUPPORT_AVATAR_ALT,
  LIVE_CHAT_SUPPORT_WAITING_COPY,
} from "@/lib/live-chat/support-lead-display"
import type { LiveChatSupportTeamMember } from "@/lib/services/liveChatSupportTeamDisplay"

interface LiveChatWaitingBannerProps {
  lead: LiveChatSupportTeamMember
  assignedAgent: LiveChatSupportTeamMember | null
  isAssignedAgentOnline: boolean
  isAssignedAgentTyping: boolean
  isSupportOnline: boolean
}

export function LiveChatWaitingBanner({
  lead,
  assignedAgent,
  isAssignedAgentOnline,
  isAssignedAgentTyping,
  isSupportOnline,
}: LiveChatWaitingBannerProps) {
  const face = assignedAgent ?? lead
  const status = assignedAgent
    ? isAssignedAgentTyping || isAssignedAgentOnline
      ? "online"
      : "away"
    : null

  const title = assignedAgent
    ? assignedAgent.name
    : isSupportOnline
      ? LIVE_CHAT_SUPPORT_WAITING_COPY.online
      : LIVE_CHAT_SUPPORT_WAITING_COPY.waiting

  const detail = assignedAgent
    ? isAssignedAgentTyping
      ? "Typing…"
      : isAssignedAgentOnline
        ? "In this chat · Online"
        : "On this conversation"
    : null

  return (
    <div className="flex items-center gap-3 border-t border-border/50 bg-muted/20 px-4 py-3">
      <LiveChatSupportLeadAvatar
        member={face}
        size="sm"
        status={status}
        imageAlt={assignedAgent ? assignedAgent.name : LIVE_CHAT_SUPPORT_AVATAR_ALT}
      />
      <div className="min-w-0">
        <p className={assignedAgent ? "truncate text-sm font-medium text-foreground" : "text-sm text-muted-foreground"}>
          {title}
        </p>
        {detail ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  )
}

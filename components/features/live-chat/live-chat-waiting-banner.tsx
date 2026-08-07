"use client"

import { LiveChatSupportLeadAvatar } from "@/components/features/live-chat/live-chat-support-lead-avatar"
import {
  LIVE_CHAT_ANONYMOUS_TEAM_AVATARS,
  LIVE_CHAT_SUPPORT_AVATAR_ALT,
  LIVE_CHAT_SUPPORT_WAITING_COPY,
} from "@/lib/live-chat/support-lead-display"
import type { LiveChatSupportTeamMember } from "@/lib/services/liveChatSupportTeamDisplay"
import { cn } from "@/lib/utils"

interface LiveChatWaitingBannerProps {
  lead: LiveChatSupportTeamMember
  isSupportOnline: boolean
}

export function LiveChatWaitingBanner({ lead, isSupportOnline }: LiveChatWaitingBannerProps) {
  return (
    <div className="flex items-center gap-3 border-t border-border/50 bg-muted/20 px-4 py-3">
      <div className="flex shrink-0 -space-x-2" aria-hidden>
        <LiveChatSupportLeadAvatar
          member={lead}
          size="sm"
          imageAlt={LIVE_CHAT_SUPPORT_AVATAR_ALT}
          className="relative z-30"
        />
        {LIVE_CHAT_ANONYMOUS_TEAM_AVATARS.map((member, index) => (
          <LiveChatSupportLeadAvatar
            key={member.id}
            member={member}
            size="sm"
            imageAlt=""
            className={cn("relative", member.avatarClassName, index === 0 ? "z-20" : "z-10")}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {isSupportOnline
          ? LIVE_CHAT_SUPPORT_WAITING_COPY.online
          : LIVE_CHAT_SUPPORT_WAITING_COPY.waiting}
      </p>
    </div>
  )
}

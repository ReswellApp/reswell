"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ChevronRight, MessageCircle, ShieldCheck, X } from "lucide-react"
import { LiveChatSupportLeadAvatar } from "@/components/features/live-chat/live-chat-support-lead-avatar"
import { LiveChatWordmark } from "@/components/features/live-chat/live-chat-wordmark"
import type { LiveChatSupportTeamMember } from "@/lib/services/liveChatSupportTeamDisplay"
import {
  LIVE_CHAT_HOME_GREETING,
  LIVE_CHAT_HOME_HEADER_IMAGE,
  LIVE_CHAT_HOME_HELP_CTA,
  LIVE_CHAT_HOME_HELP_PREVIEW,
  LIVE_CHAT_HOME_HELP_SECTION,
  LIVE_CHAT_HOME_MESSAGE_CTA,
  LIVE_CHAT_HOME_MESSAGE_SUBOFFLINE,
  LIVE_CHAT_HOME_MESSAGE_SUBONLINE,
  LIVE_CHAT_HOME_SUBGREETING,
  LIVE_CHAT_HOME_TAGLINE,
  LIVE_CHAT_HOME_TRUST,
} from "@/lib/live-chat/widget-config"
import {
  liveChatCardButtonClass,
  liveChatCardClass,
} from "@/lib/live-chat/widget-ui"
import { cn } from "@/lib/utils"

export interface LiveChatHomeRecentMessage {
  content: string
  createdAt: string
  fromAgent: boolean
  senderName: string
}

interface LiveChatHomeViewProps {
  isSupportOnline: boolean
  onSendMessage: () => void
  onOpenHelp: () => void
  onClose: () => void
  recentMessage?: LiveChatHomeRecentMessage | null
  supportLead?: LiveChatSupportTeamMember
}

export function LiveChatHomeView({
  isSupportOnline,
  onSendMessage,
  onOpenHelp,
  onClose,
  recentMessage,
  supportLead,
}: LiveChatHomeViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
      <div
        className="relative shrink-0 overflow-hidden bg-cover bg-center px-5 pb-5 pt-4 text-white"
        style={{ backgroundImage: `url(${LIVE_CHAT_HOME_HEADER_IMAGE})` }}
      >
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70"
          aria-hidden
        />
        <div className="relative z-10">
          <div className="mb-5 flex items-start justify-between gap-3">
            <LiveChatWordmark onPrimary />
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition-colors hover:bg-black/40"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/80">
            {LIVE_CHAT_HOME_TAGLINE}
          </p>
          <h2 className="mt-2 text-[1.65rem] font-bold leading-tight tracking-tight text-white">
            {LIVE_CHAT_HOME_GREETING}
          </h2>
          <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-white/90">
            {LIVE_CHAT_HOME_SUBGREETING}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 pt-3">
        {recentMessage ? (
          <button
            type="button"
            onClick={onSendMessage}
            className={cn(liveChatCardClass, "group shrink-0 p-4 text-left hover:bg-muted/40")}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-listingHeart">
                Recent message
              </p>
              {recentMessage.fromAgent ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-listingHeart" aria-hidden />
              ) : null}
            </div>
            <div className="mt-2.5 flex items-start gap-3">
              {supportLead ? (
                <LiveChatSupportLeadAvatar member={supportLead} className="border-border/40" />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {recentMessage.senderName}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(recentMessage.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground">
                  {recentMessage.content}
                </p>
              </div>
              <ChevronRight
                className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </div>
          </button>
        ) : null}

        <button type="button" onClick={onSendMessage} className={cn(liveChatCardClass, liveChatCardButtonClass, "group shrink-0")}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-listingHeart/10 text-listingHeart transition-colors group-hover:bg-listingHeart/15">
            <MessageCircle className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{LIVE_CHAT_HOME_MESSAGE_CTA}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {isSupportOnline ? LIVE_CHAT_HOME_MESSAGE_SUBONLINE : LIVE_CHAT_HOME_MESSAGE_SUBOFFLINE}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>

        <div className={cn(liveChatCardClass, "shrink-0")}>
          <button
            type="button"
            onClick={onOpenHelp}
            className="flex w-full items-center justify-between border-b border-border/50 px-4 py-3.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
          >
            {LIVE_CHAT_HOME_HELP_CTA}
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          </button>
          <p className="border-b border-border/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {LIVE_CHAT_HOME_HELP_SECTION}
          </p>
          <ul className="divide-y divide-border/40">
            {LIVE_CHAT_HOME_HELP_PREVIEW.map((article) => (
              <li key={article.href}>
                <Link
                  href={article.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 px-4 py-3 text-sm text-foreground/90 transition-colors hover:bg-muted/60"
                >
                  <span className="line-clamp-2 leading-snug">{article.title}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="flex items-center justify-center gap-1.5 px-2 pb-1 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-listingHeart" aria-hidden />
          {LIVE_CHAT_HOME_TRUST}
        </p>
      </div>
    </div>
  )
}

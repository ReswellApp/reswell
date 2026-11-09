"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { RelativeTime } from "@/components/ui/relative-time"
import { MessageCircle, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { VerifiedBadge } from "@/components/verified-badge"
import { MessageSmsNotificationsToggle } from "@/components/features/messages/message-sms-notifications-toggle"
import { MessageProfileAvatar } from "@/components/features/messages/message-profile-avatar"
import { useMessagesInbox } from "@/components/features/messages/messages-inbox-context"
import { useFlatMobileMessagesInbox } from "@/hooks/use-flat-mobile-messages-inbox"
import {
  counterpartyInboxHref,
  groupConversationsByCounterparty,
} from "@/lib/utils/messages-inbox-grouping"
import { formatInboxChatPreviewText } from "@/lib/utils/messages-inbox-preview"
import { formatInboxTimestamp } from "@/lib/utils/message-display-time"
import { cn } from "@/lib/utils"

interface MessagesInboxListPaneProps {
  activeConversationId?: string | null
  className?: string
}

export function MessagesInboxListPane({
  activeConversationId = null,
  className,
}: MessagesInboxListPaneProps) {
  const pathname = usePathname() ?? ""
  const flatMobileInbox = useFlatMobileMessagesInbox()
  const { currentUserId, conversations, messageSmsOptIn, smsPhone } = useMessagesInbox()
  const [searchQuery, setSearchQuery] = useState("")

  const searchLower = searchQuery.trim().toLowerCase()
  const groupedChats = groupConversationsByCounterparty(conversations, currentUserId)

  const filteredGroups = groupedChats.filter((group) => {
    if (!searchLower) return true
    const name = group.otherUser?.display_name?.toLowerCase() ?? ""
    const listingTitles = group.threads
      .map((t) => t.listing?.title?.toLowerCase() ?? "")
      .join(" ")
    const preview = (group.latestMessage?.content || "").toLowerCase()
    return (
      name.includes(searchLower) ||
      listingTitles.includes(searchLower) ||
      preview.includes(searchLower)
    )
  })

  const isActiveGroup = (group: (typeof groupedChats)[number]) => {
    if (activeConversationId) {
      return group.threads.some((t) => t.id === activeConversationId)
    }
    const href = counterpartyInboxHref(group)
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className={cn("flex flex-col", flatMobileInbox ? "flex-none" : "min-h-0 flex-1", className)}>
      <div
        className={cn(
          "relative shrink-0 py-2",
          flatMobileInbox ? "px-0" : "px-3",
        )}
      >
        <Search
          className={cn(
            "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
            flatMobileInbox ? "left-3" : "left-6",
          )}
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 rounded-full border-0 bg-muted text-[16px] shadow-none placeholder:text-muted-foreground/80 pl-10"
        />
      </div>

      <MessageSmsNotificationsToggle
        initialOptIn={messageSmsOptIn}
        initialPhone={smsPhone}
        className={flatMobileInbox ? "px-0" : undefined}
      />

      <div className={cn(flatMobileInbox ? "flex-none" : "min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y [scrollbar-width:thin]")}>
        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            {searchLower && groupedChats.length > 0 ? (
              <>
                <p className="text-[15px] font-medium text-foreground">No matching chats</p>
                <p className="mt-2 text-[14px] text-muted-foreground">
                  Try another name or listing title.
                </p>
              </>
            ) : (
              <>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <MessageCircle className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-[15px] font-semibold text-foreground">No messages yet</p>
                <p className="mt-2 max-w-[260px] text-[14px] leading-relaxed text-muted-foreground">
                  When you contact a seller or receive a message, it will appear here.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className={cn("py-1", flatMobileInbox ? "px-0" : "px-2")}>
            {filteredGroups.map((group) => {
              const otherUser = group.otherUser
              const unreadCount = group.totalUnread
              const href = counterpartyInboxHref(group)
              const active = isActiveGroup(group)
              const previewText = formatInboxChatPreviewText(
                group.latestMessage,
                group.primaryThread.listing?.title,
                currentUserId,
              )

              return (
                <li key={group.otherUserId}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors",
                      active ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <MessageProfileAvatar
                      avatarUrl={otherUser?.avatar_url}
                      displayName={otherUser?.display_name}
                      pending={!otherUser}
                      size="inbox"
                      className="ring-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1">
                          <span
                            className={cn(
                              "truncate text-[16px] text-foreground",
                              unreadCount > 0 ? "font-semibold" : "font-medium",
                            )}
                          >
                            {otherUser?.display_name || "Unknown User"}
                          </span>
                          {otherUser?.shop_verified ? (
                            <VerifiedBadge size="sm" />
                          ) : null}
                        </div>
                        {group.latestActivityMs > 0 ? (
                          <RelativeTime
                            iso={new Date(group.latestActivityMs).toISOString()}
                            formatLabel={formatInboxTimestamp}
                            className={cn(
                              "shrink-0 text-[12px]",
                              unreadCount > 0 ? "font-medium text-listingHeart" : "text-muted-foreground",
                            )}
                          />
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "min-w-0 flex-1 truncate text-[14px] leading-snug",
                            unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {previewText}
                        </p>
                        {unreadCount > 0 ? (
                          <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-listingHeart px-1 text-[11px] font-semibold tabular-nums text-white">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { ChevronDown, Heart, MessageSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { NavUnreadCountBadge } from "@/components/nav-unread-count-badge"
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock"
import { MessageProfileAvatar } from "@/components/features/messages/message-profile-avatar"
import { markInboxNotificationsRead, refreshMessagesInbox } from "@/app/actions/messages"
import type { MessagesInboxNotification } from "@/lib/db/messagesInbox"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import {
  counterpartyInboxHref,
  groupConversationsByCounterparty,
  type InboxConversationRow,
} from "@/lib/utils/messages-inbox-grouping"
import {
  activityKindLabel,
  countUnreadInboxActivityNotifications,
  filterInboxActivityNotifications,
  inboxActivityNotificationHref,
} from "@/lib/utils/messages-inbox-activity"
import { formatInboxChatPreviewText } from "@/lib/utils/messages-inbox-preview"
import { cn } from "@/lib/utils"

const NAV_PREVIEW_LIMIT = 8

type NavMessagesTab = "activity" | "messages"

interface NavMessagesDropdownProps {
  userId: string
  unreadMessages: number
  triggerClassName?: string
  iconClassName?: string
}

function NavMessagesEmptyState({ tab }: { tab: NavMessagesTab }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
        {tab === "activity" ? (
          <Heart className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        ) : (
          <MessageSquare className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        )}
      </div>
      <p className="text-[15px] font-semibold text-foreground">Nothing here yet</p>
      <p className="mt-1.5 max-w-[220px] text-[13px] leading-relaxed text-muted-foreground">
        {tab === "activity"
          ? "When someone favorites your listing or follows you, updates will show here."
          : "When you contact a seller or receive a message, it will appear here."}
      </p>
    </div>
  )
}

export function NavMessagesDropdown({
  userId,
  unreadMessages,
  triggerClassName,
  iconClassName,
}: NavMessagesDropdownProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mobileScrollLock, setMobileScrollLock] = useState(false)
  const [tab, setTab] = useState<NavMessagesTab>("messages")
  const [loading, setLoading] = useState(false)
  const [conversations, setConversations] = useState<InboxConversationRow[]>([])
  const [notifications, setNotifications] = useState<MessagesInboxNotification[]>([])

  const activityNotifications = useMemo(
    () => filterInboxActivityNotifications(notifications),
    [notifications],
  )
  const unreadActivityCount = useMemo(
    () => countUnreadInboxActivityNotifications(notifications),
    [notifications],
  )
  const chatGroups = useMemo(
    () => groupConversationsByCounterparty(conversations, userId).slice(0, NAV_PREVIEW_LIMIT),
    [conversations, userId],
  )
  const previewActivity = activityNotifications.slice(0, NAV_PREVIEW_LIMIT)

  const loadInbox = useCallback(async () => {
    setLoading(true)
    try {
      const fresh = await refreshMessagesInbox()
      if ("error" in fresh) return
      setConversations(fresh.conversations)
      setNotifications(fresh.notifications)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadInbox()
  }, [open, loadInbox])

  useEffect(() => {
    function onUnreadRefresh() {
      if (open) void loadInbox()
    }
    window.addEventListener("unreadCountRefresh", onUnreadRefresh)
    return () => window.removeEventListener("unreadCountRefresh", onUnreadRefresh)
  }, [open, loadInbox])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next && unreadActivityCount > 0 && tab === "activity") {
        void markInboxNotificationsRead().then(() => {
          window.dispatchEvent(new CustomEvent("unreadCountRefresh"))
        })
      }
    },
    [tab, unreadActivityCount],
  )

  const handleTabChange = useCallback(
    (next: NavMessagesTab) => {
      setTab(next)
      if (next === "activity" && unreadActivityCount > 0) {
        void markInboxNotificationsRead().then(() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
          window.dispatchEvent(new CustomEvent("unreadCountRefresh"))
        })
      }
    },
    [unreadActivityCount],
  )

  const navigateAndClose = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  useEffect(() => {
    if (!open) {
      setMobileScrollLock(false)
      return
    }

    const syncMobileScrollLock = () => {
      setMobileScrollLock(window.innerWidth < 768)
    }

    syncMobileScrollLock()
    window.addEventListener("resize", syncMobileScrollLock)
    return () => window.removeEventListener("resize", syncMobileScrollLock)
  }, [open])

  useBodyScrollLock(mobileScrollLock)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative text-foreground hover:bg-black/5 md:hover:bg-muted", triggerClassName)}
          aria-label="Messages and activity"
        >
          <MessageSquare className={cn("h-6 w-6", iconClassName)} />
          <NavUnreadCountBadge count={unreadMessages} overlay />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        avoidCollisions
        className={cn(
          "z-[120] flex flex-col border border-border/80 bg-popover p-0 shadow-lg",
          "w-[min(100vw-2rem,380px)] rounded-2xl",
          "max-md:fixed max-md:inset-0 max-md:z-[120] max-md:h-dvh max-md:w-screen max-md:max-w-none",
          "max-md:!translate-x-0 max-md:!translate-y-0 max-md:rounded-none max-md:border-0 max-md:shadow-none",
          "max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Messages</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-foreground hover:bg-muted md:hidden"
            aria-label="Close messages"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="shrink-0 px-3 pt-3">
          <div
            className="flex w-full gap-1 rounded-xl border border-border/70 bg-muted/60 p-1 shadow-[inset_0_1px_2px_rgba(17,17,17,0.04)]"
            role="tablist"
            aria-label="Activity and messages"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "activity"}
              onClick={() => handleTabChange("activity")}
              className={cn(
                "flex min-h-9 flex-1 items-center justify-center gap-1 rounded-[9px] px-2 py-2 text-[13px] font-semibold transition-colors",
                tab === "activity"
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="truncate">Activity</span>
              {unreadActivityCount > 0 ? (
                <span className="tabular-nums text-[12px] font-medium text-muted-foreground">
                  ({unreadActivityCount > 99 ? "99+" : unreadActivityCount})
                </span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "messages"}
              onClick={() => handleTabChange("messages")}
              className={cn(
                "flex min-h-9 flex-1 items-center justify-center gap-1 rounded-[9px] px-2 py-2 text-[13px] font-semibold transition-colors",
                tab === "messages"
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="truncate">Messages</span>
              {unreadMessages > 0 ? (
                <span className="tabular-nums text-[12px] font-medium text-muted-foreground">
                  ({unreadMessages > 99 ? "99+" : unreadMessages})
                </span>
              ) : null}
            </button>
          </div>
        </div>

        <div
          className={cn(
            "min-h-0 overflow-y-auto px-1 py-2",
            "max-md:flex-1 md:max-h-[min(60vh,420px)]",
          )}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : tab === "activity" ? (
            previewActivity.length === 0 ? (
              <NavMessagesEmptyState tab="activity" />
            ) : (
              <ul className="divide-y divide-border/50">
                {previewActivity.map((n) => {
                  const listing = n.listings
                  const href = inboxActivityNotificationHref(n)
                  const thumb =
                    listing?.listing_images && listingTitleThumbnailSrc(listing.listing_images)
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => navigateAndClose(href)}
                        className={cn(
                          "flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50",
                          !n.is_read && "bg-blue-50/40 dark:bg-blue-950/15",
                        )}
                      >
                        <div className="relative w-11 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/35 aspect-[3/4]">
                          {thumb ? (
                            <Image
                              src={thumb}
                              alt=""
                              fill
                              sizes="44px"
                              className="object-cover"
                              unoptimized={listingImageShouldBypassOptimization(thumb)}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Heart className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.5} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {listing?.title ? (
                            <p className="truncate text-[12px] font-medium text-muted-foreground">
                              {capitalizeWords(listing.title)}
                            </p>
                          ) : null}
                          <div className="mt-0.5 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="mr-1.5 inline-flex rounded-full bg-muted/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground ring-1 ring-border/40">
                                {activityKindLabel(n.type)}
                              </span>
                              <span className="text-[13px] font-medium leading-snug text-foreground">
                                {n.message || "Someone saved your item"}
                              </span>
                            </div>
                            <time
                              className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                              dateTime={n.created_at}
                            >
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                            </time>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )
          ) : chatGroups.length === 0 ? (
            <NavMessagesEmptyState tab="messages" />
          ) : (
            <ul className="divide-y divide-border/50">
              {chatGroups.map((group) => {
                const otherUser = group.otherUser
                const href = counterpartyInboxHref(group)
                const previewText = formatInboxChatPreviewText(
                  group.latestMessage,
                  group.primaryThread.listing?.title,
                  userId,
                )
                return (
                  <li key={group.otherUserId}>
                    <button
                      type="button"
                      onClick={() => navigateAndClose(href)}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <MessageProfileAvatar
                        avatarUrl={otherUser?.avatar_url}
                        displayName={otherUser?.display_name}
                        pending={!otherUser}
                        size="sm"
                        className="ring-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-[14px] text-foreground",
                              group.totalUnread > 0 ? "font-semibold" : "font-medium",
                            )}
                          >
                            {otherUser?.display_name || "Unknown User"}
                          </span>
                          {group.latestActivityMs > 0 ? (
                            <time
                              className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                              dateTime={new Date(group.latestActivityMs).toISOString()}
                            >
                              {formatDistanceToNow(new Date(group.latestActivityMs), {
                                addSuffix: true,
                              })}
                            </time>
                          ) : null}
                        </div>
                        <p
                          className={cn(
                            "mt-0.5 truncate text-[13px] text-muted-foreground",
                            group.totalUnread > 0 && "font-medium text-foreground",
                          )}
                        >
                          {previewText}
                        </p>
                      </div>
                      {group.totalUnread > 0 ? (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold tabular-nums text-background">
                          {group.totalUnread > 99 ? "99+" : group.totalUnread}
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-border/70 px-3 py-2.5">
          {tab === "messages" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-full justify-between rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground"
              asChild
              onClick={() => setOpen(false)}
            >
              <Link href="/messages">
                See all messages
                <ChevronDown className="h-4 w-4 -rotate-90" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

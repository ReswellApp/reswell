"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Bell, ChevronDown, Heart, MessageSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { NavUnreadCountBadge } from "@/components/nav-unread-count-badge"
import { useIsMobile } from "@/hooks/use-mobile"
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
  triggerIcon?: "message" | "bell"
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

interface NavMessagesPanelBodyProps {
  userId: string
  unreadMessages: number
  unreadActivityCount: number
  tab: NavMessagesTab
  loading: boolean
  previewActivity: MessagesInboxNotification[]
  chatGroups: ReturnType<typeof groupConversationsByCounterparty>
  onTabChange: (tab: NavMessagesTab) => void
  onClose: () => void
  onNavigate: (href: string) => void
  showCloseButton?: boolean
  scrollClassName?: string
}

function NavMessagesPanelBody({
  userId,
  unreadMessages,
  unreadActivityCount,
  tab,
  loading,
  previewActivity,
  chatGroups,
  onTabChange,
  onClose,
  onNavigate,
  showCloseButton = false,
  scrollClassName,
}: NavMessagesPanelBodyProps) {
  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
        {showCloseButton ? (
          <SheetTitle className="text-base font-semibold text-foreground">Messages</SheetTitle>
        ) : (
          <h2 className="text-base font-semibold text-foreground">Messages</h2>
        )}
        {showCloseButton ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-foreground hover:bg-muted"
            aria-label="Close messages"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        ) : null}
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
            onClick={() => onTabChange("activity")}
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
            onClick={() => onTabChange("messages")}
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

      <div className={cn("min-h-0 overflow-y-auto px-1 py-2", scrollClassName)}>
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
                      onClick={() => onNavigate(href)}
                      className={cn(
                        "flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50",
                        !n.is_read && "bg-blue-50/40 dark:bg-blue-950/15",
                      )}
                    >
                      <div className="relative aspect-[3/4] w-11 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/35">
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
                    onClick={() => onNavigate(href)}
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
            onClick={onClose}
          >
            <Link href="/messages">
              See all messages
              <ChevronDown className="h-4 w-4 -rotate-90" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
    </>
  )
}

export function NavMessagesDropdown({
  userId,
  unreadMessages,
  triggerClassName,
  iconClassName,
  triggerIcon = "message",
}: NavMessagesDropdownProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
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

  const panelProps: NavMessagesPanelBodyProps = {
    userId,
    unreadMessages,
    unreadActivityCount,
    tab,
    loading,
    previewActivity,
    chatGroups,
    onTabChange: handleTabChange,
    onClose: () => setOpen(false),
    onNavigate: navigateAndClose,
  }

  const TriggerIcon = triggerIcon === "bell" ? Bell : MessageSquare

  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative text-foreground hover:bg-black/5 md:hover:bg-muted", triggerClassName)}
      aria-label={triggerIcon === "bell" ? "Notifications" : "Messages and activity"}
      aria-expanded={open}
      onClick={isMobile ? () => handleOpenChange(true) : undefined}
    >
      <TriggerIcon className={cn("h-6 w-6", iconClassName)} />
      <NavUnreadCountBadge count={unreadMessages} overlay />
    </Button>
  )

  if (isMobile) {
    return (
      <>
        {triggerButton}
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent
            side="bottom"
            className={cn(
              "z-[120] flex h-[100dvh] w-full max-w-none flex-col gap-0 rounded-none border-0 p-0",
              "inset-x-0 top-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]",
              "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
              "[&>button.absolute]:hidden",
            )}
          >
            <NavMessagesPanelBody {...panelProps} showCloseButton scrollClassName="flex-1" />
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        avoidCollisions
        collisionPadding={16}
        className={cn(
          "z-[120] flex w-[min(100vw-2rem,380px)] flex-col rounded-2xl border border-border/80 bg-popover p-0 shadow-lg",
        )}
      >
        <NavMessagesPanelBody
          {...panelProps}
          scrollClassName="max-h-[min(60vh,420px)]"
        />
      </PopoverContent>
    </Popover>
  )
}

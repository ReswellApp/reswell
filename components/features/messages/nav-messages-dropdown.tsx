"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { RelativeTime, formatDistanceToNowLabel } from "@/components/ui/relative-time"
import { Bell, ChevronDown, Heart, LifeBuoy, MessageSquare, X } from "lucide-react"
import { Button, iconButtonHoverClassName } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { NavUnreadCountBadge } from "@/components/nav-unread-count-badge"
import { useIsMobile } from "@/hooks/use-mobile"
import { MessageProfileAvatar } from "@/components/features/messages/message-profile-avatar"
import { markInboxNotificationsRead, refreshMessagesInbox } from "@/app/actions/messages"
import type { MessagesInboxNotification } from "@/lib/db/messagesInbox"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { listingPhotoFillClassName } from "@/lib/listing-photo-fill"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import {
  applyInboxThreadActivity,
  counterpartyInboxHref,
  groupConversationsByCounterparty,
  markConversationMessagesReadLocally,
  mergeInboxConversationSnapshots,
  type InboxConversationRow,
  type InboxThreadActivity,
} from "@/lib/utils/messages-inbox-grouping"
import {
  activityKindLabel,
  countUnreadInboxActivityNotifications,
  filterInboxActivityNotifications,
  inboxActivityNotificationHref,
  isSupportActivityType,
} from "@/lib/utils/messages-inbox-activity"
import { formatInboxChatPreviewText } from "@/lib/utils/messages-inbox-preview"
import {
  isNavMessagesPreviewCacheStale,
  readNavMessagesPreviewCache,
  writeNavMessagesPreviewCache,
} from "@/lib/utils/nav-messages-preview-cache"
import { cn } from "@/lib/utils"
import {
  CONVERSATION_INBOX_ACTIVITY_EVENT,
  CONVERSATION_THREAD_OPENED_EVENT,
  MESSAGES_INBOX_REFRESH_EVENT,
  dispatchUnreadCountRefresh,
  type ConversationThreadOpenedDetail,
} from "@/lib/utils/unread-message-count-events"
import { useLiveUnreadSupportCount } from "@/components/features/support/use-live-unread-support-count"
import { inboxTickerCount } from "@/lib/utils/inbox-ticker-count"

const NAV_PREVIEW_LIMIT = 8
/** Enough recent threads for an 8-row counterparty preview after support filtering. */
const NAV_CONVERSATION_FETCH_LIMIT = 48

type NavMessagesTab = "activity" | "messages"

interface NavMessagesDropdownProps {
  userId: string
  unreadMessages: number
  unreadSupport?: number
  triggerClassName?: string
  iconClassName?: string
  iconStrokeWidth?: number
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
          ? "Favorites, follows, and Reswell support replies show up here."
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
                const supportReply = isSupportActivityType(n.type)
                const title = supportReply
                  ? n.support_subject
                  : listing?.title
                    ? capitalizeWords(listing.title)
                    : null
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
                      <div
                        className={cn(
                          "relative aspect-[3/4] h-[3.67rem] w-11 shrink-0 self-center overflow-hidden rounded-lg ring-1",
                          supportReply
                            ? "flex items-center justify-center bg-listingHeart text-white ring-listingHeart/20"
                            : "bg-muted ring-border/35",
                        )}
                      >
                        {supportReply ? (
                          <LifeBuoy className="h-4 w-4" strokeWidth={1.75} />
                        ) : thumb ? (
                          <Image
                            src={thumb}
                            alt=""
                            fill
                            sizes="44px"
                            className={listingPhotoFillClassName}
                            unoptimized={listingImageShouldBypassOptimization(thumb)}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Heart className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {title ? (
                          <p className="truncate text-[12px] font-medium text-muted-foreground">
                            {title}
                          </p>
                        ) : null}
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="flex min-w-0 items-center gap-1.5">
                            <span className="inline-flex shrink-0 rounded-full bg-muted/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground ring-1 ring-border/40">
                              {activityKindLabel(n.type)}
                            </span>
                            <span className="truncate text-[13px] font-medium text-foreground">
                              {n.message || "Someone saved your item"}
                            </span>
                          </p>
                          <RelativeTime
                            iso={n.created_at}
                            formatLabel={formatDistanceToNowLabel}
                            className="shrink-0 text-[11px] text-muted-foreground"
                          />
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
                          <RelativeTime
                            iso={new Date(group.latestActivityMs).toISOString()}
                            formatLabel={formatDistanceToNowLabel}
                            className="shrink-0 text-[11px] text-muted-foreground"
                          />
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
  unreadSupport = 0,
  triggerClassName,
  iconClassName,
  iconStrokeWidth,
  triggerIcon = "message",
}: NavMessagesDropdownProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const liveSupportUnread = useLiveUnreadSupportCount(unreadSupport)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<NavMessagesTab>(() =>
    unreadSupport > 0 ? "activity" : "messages",
  )
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(
    () => readNavMessagesPreviewCache(userId) != null,
  )
  const [conversations, setConversations] = useState<InboxConversationRow[]>(
    () => readNavMessagesPreviewCache(userId)?.conversations ?? [],
  )
  const [notifications, setNotifications] = useState<MessagesInboxNotification[]>(
    () => readNavMessagesPreviewCache(userId)?.notifications ?? [],
  )
  const loadGenerationRef = useRef(0)
  const openRef = useRef(open)
  const userIdRef = useRef(userId)
  const conversationsRef = useRef(conversations)
  const notificationsRef = useRef(notifications)
  openRef.current = open
  userIdRef.current = userId
  conversationsRef.current = conversations
  notificationsRef.current = notifications

  // Shop-switch / remount: rehydrate from the module cache for this inbox user.
  useEffect(() => {
    const cached = readNavMessagesPreviewCache(userId)
    if (cached) {
      setConversations(cached.conversations)
      setNotifications(cached.notifications)
      setHasLoaded(true)
      return
    }
    setConversations([])
    setNotifications([])
    setHasLoaded(false)
  }, [userId])

  const activityNotifications = useMemo(
    () => filterInboxActivityNotifications(notifications),
    [notifications],
  )
  const unreadActivityCount = useMemo(() => {
    const fromInbox = countUnreadInboxActivityNotifications(notifications)
    return Math.max(fromInbox, liveSupportUnread)
  }, [notifications, liveSupportUnread])
  const tickerCount = inboxTickerCount(unreadMessages, liveSupportUnread)
  const chatGroups = useMemo(
    () => groupConversationsByCounterparty(conversations, userId).slice(0, NAV_PREVIEW_LIMIT),
    [conversations, userId],
  )
  const previewActivity = activityNotifications.slice(0, NAV_PREVIEW_LIMIT)
  // Keep prior / cached rows visible while refreshing — only blank with no cache.
  const showLoading = loading && !hasLoaded

  const persistPreview = useCallback(
    (
      nextConversations: InboxConversationRow[],
      nextNotifications: MessagesInboxNotification[],
      inboxUserId = userIdRef.current,
    ) => {
      writeNavMessagesPreviewCache(inboxUserId, {
        conversations: nextConversations,
        notifications: nextNotifications,
      })
      setConversations(nextConversations)
      setNotifications(nextNotifications)
      setHasLoaded(true)
    },
    [],
  )

  const loadInbox = useCallback(async () => {
    const generation = ++loadGenerationRef.current
    const inboxUserId = userIdRef.current
    setLoading(true)
    try {
      const fresh = await refreshMessagesInbox({
        conversationLimit: NAV_CONVERSATION_FETCH_LIMIT,
      })
      if (generation !== loadGenerationRef.current) return
      if ("error" in fresh) return
      // Drop the response if the signed-in inbox user changed mid-flight.
      if (inboxUserId !== userIdRef.current) return

      const merged = mergeInboxConversationSnapshots(
        conversationsRef.current,
        fresh.conversations,
      )
      persistPreview(merged, fresh.notifications, inboxUserId)
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false)
      }
    }
  }, [persistPreview])

  const prefetchInboxIfStale = useCallback(() => {
    if (!isNavMessagesPreviewCacheStale(readNavMessagesPreviewCache(userIdRef.current))) {
      return
    }
    void loadInbox()
  }, [loadInbox])

  useEffect(() => {
    if (!open) return
    void loadInbox()
  }, [open, loadInbox])

  useEffect(() => {
    function onInboxRefresh() {
      // Badge-only `unreadCountRefresh` must not re-fetch the panel — opening the
      // dropdown already dispatches that event, which previously stacked loads.
      // Closed-panel content stays warm via the module cache + local activity patches;
      // open always revalidates.
      if (openRef.current) void loadInbox()
    }
    function onThreadOpened(event: Event) {
      const detail = (event as CustomEvent<ConversationThreadOpenedDetail>).detail
      if (!detail?.conversationId) return
      const next = markConversationMessagesReadLocally(
        conversationsRef.current,
        detail.conversationId,
        userId,
      )
      persistPreview(next, notificationsRef.current, userId)
    }
    function onInboxActivity(event: Event) {
      const detail = (event as CustomEvent<InboxThreadActivity>).detail
      if (!detail?.conversationId) return
      const next = applyInboxThreadActivity(conversationsRef.current, detail)
      persistPreview(next, notificationsRef.current, userId)
    }
    window.addEventListener(MESSAGES_INBOX_REFRESH_EVENT, onInboxRefresh)
    window.addEventListener(CONVERSATION_THREAD_OPENED_EVENT, onThreadOpened)
    window.addEventListener(CONVERSATION_INBOX_ACTIVITY_EVENT, onInboxActivity)
    return () => {
      window.removeEventListener(MESSAGES_INBOX_REFRESH_EVENT, onInboxRefresh)
      window.removeEventListener(CONVERSATION_THREAD_OPENED_EVENT, onThreadOpened)
      window.removeEventListener(CONVERSATION_INBOX_ACTIVITY_EVENT, onInboxActivity)
    }
  }, [loadInbox, persistPreview, userId])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next) {
        // Pull a fresh badge count whenever the panel opens.
        dispatchUnreadCountRefresh()
      }
      if (next && unreadActivityCount > 0 && tab === "activity") {
        void markInboxNotificationsRead().then(() => {
          dispatchUnreadCountRefresh()
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
          const updated = notificationsRef.current.map((n) =>
            isSupportActivityType(n.type) ? n : { ...n, is_read: true },
          )
          persistPreview(conversationsRef.current, updated, userId)
          window.dispatchEvent(new CustomEvent("unreadCountRefresh"))
        })
      }
    },
    [persistPreview, unreadActivityCount, userId],
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
    loading: showLoading,
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
      className={cn(
        "text-foreground",
        iconButtonHoverClassName,
        triggerClassName,
      )}
      aria-label={triggerIcon === "bell" ? "Notifications" : "Messages and activity"}
      aria-expanded={open}
      onPointerEnter={prefetchInboxIfStale}
      onFocus={prefetchInboxIfStale}
      onClick={isMobile ? () => handleOpenChange(true) : undefined}
    >
      <TriggerIcon className={cn("h-6 w-6", iconClassName)} strokeWidth={iconStrokeWidth} />
      <NavUnreadCountBadge count={tickerCount} overlay />
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

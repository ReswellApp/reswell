"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Flame, MessageSquare, X } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MessageProfileAvatar } from "@/components/features/messages/message-profile-avatar"
import {
  markThreadsInboxNotificationsRead,
  refreshThreadsInbox,
} from "@/app/actions/threads-inbox"
import type { ForumInboxNotification } from "@/lib/types/forum-notifications-inbox"
import {
  actorDisplayName,
  filterForumActivityNotifications,
  filterForumReplyNotifications,
  forumActivityKindLabel,
  forumNotificationHref,
  groupForumReplyNotifications,
} from "@/lib/utils/threads-inbox-display"
import { cn } from "@/lib/utils"

export const THREADS_UNREAD_REFRESH_EVENT = "threadsUnreadCountRefresh"

export type ThreadsInboxTab = "activity" | "messages"

export function dispatchThreadsUnreadCountRefresh(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(THREADS_UNREAD_REFRESH_EVENT))
}

type UseThreadsInboxOptions = {
  enabled?: boolean
  initialUnreadReplies?: number
  initialTab?: ThreadsInboxTab
  groupLimit?: number
}

export function useThreadsInbox({
  enabled = true,
  initialUnreadReplies = 0,
  initialTab = "messages",
  groupLimit,
}: UseThreadsInboxOptions = {}) {
  const [tab, setTab] = useState<ThreadsInboxTab>(initialTab)
  const [loading, setLoading] = useState(false)
  const [liveUnreadReplies, setLiveUnreadReplies] = useState(initialUnreadReplies)
  const [notifications, setNotifications] = useState<ForumInboxNotification[]>([])

  useEffect(() => {
    setLiveUnreadReplies(initialUnreadReplies)
  }, [initialUnreadReplies])

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  const activityNotifications = useMemo(
    () => filterForumActivityNotifications(notifications),
    [notifications],
  )
  const replyNotifications = useMemo(
    () => filterForumReplyNotifications(notifications),
    [notifications],
  )
  const unreadActivityCount = useMemo(
    () => activityNotifications.filter((n) => !n.is_read).length,
    [activityNotifications],
  )
  const messageGroups = useMemo(
    () => groupForumReplyNotifications(replyNotifications, groupLimit),
    [groupLimit, replyNotifications],
  )

  const loadInbox = useCallback(async () => {
    setLoading(true)
    try {
      const fresh = await refreshThreadsInbox()
      if ("error" in fresh) return
      setNotifications(fresh.notifications)
      setLiveUnreadReplies(fresh.unreadReplies)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void loadInbox()
  }, [enabled, loadInbox])

  useEffect(() => {
    if (!enabled) return

    function onThreadsUnreadRefresh() {
      void loadInbox()
    }

    window.addEventListener(THREADS_UNREAD_REFRESH_EVENT, onThreadsUnreadRefresh)
    return () => window.removeEventListener(THREADS_UNREAD_REFRESH_EVENT, onThreadsUnreadRefresh)
  }, [enabled, loadInbox])

  const markTabRead = useCallback(async (nextTab: ThreadsInboxTab) => {
    if (nextTab === "activity") {
      await markThreadsInboxNotificationsRead({
        types: ["thread_like", "comment_like"],
      })
      setNotifications((prev) =>
        prev.map((n) =>
          n.type === "thread_like" || n.type === "comment_like" ? { ...n, is_read: true } : n,
        ),
      )
    } else {
      await markThreadsInboxNotificationsRead({
        types: ["thread_reply", "comment_reply"],
      })
      setNotifications((prev) =>
        prev.map((n) =>
          n.type === "thread_reply" || n.type === "comment_reply" ? { ...n, is_read: true } : n,
        ),
      )
      setLiveUnreadReplies(0)
    }
    dispatchThreadsUnreadCountRefresh()
  }, [])

  const handleTabChange = useCallback(
    (next: ThreadsInboxTab) => {
      setTab(next)
      if (next === "activity" && unreadActivityCount > 0) {
        void markTabRead("activity")
      }
      if (next === "messages" && liveUnreadReplies > 0) {
        void markTabRead("messages")
      }
    },
    [liveUnreadReplies, markTabRead, unreadActivityCount],
  )

  return {
    tab,
    loading,
    liveUnreadReplies,
    unreadActivityCount,
    activityNotifications,
    messageGroups,
    loadInbox,
    markTabRead,
    handleTabChange,
    setTab,
  }
}

type ThreadsInboxEmptyStateProps = {
  tab: ThreadsInboxTab
}

export function ThreadsInboxEmptyState({ tab }: ThreadsInboxEmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
        {tab === "activity" ? (
          <Flame className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        ) : (
          <MessageSquare className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        )}
      </div>
      <p className="text-[15px] font-semibold text-foreground">Nothing here yet</p>
      <p className="mt-1.5 max-w-[240px] text-[13px] leading-relaxed text-muted-foreground">
        {tab === "activity"
          ? "When someone stokes your topic or comment, updates will show here."
          : "When someone replies on your topics or comments, they'll show up here."}
      </p>
    </div>
  )
}

type ThreadsInboxPanelProps = {
  unreadReplies: number
  unreadActivityCount: number
  tab: ThreadsInboxTab
  loading: boolean
  activityNotifications: ForumInboxNotification[]
  messageGroups: ReturnType<typeof groupForumReplyNotifications>
  onTabChange: (tab: ThreadsInboxTab) => void
  onNavigate: (href: string) => void
  title?: string
  onClose?: () => void
  showFooterLink?: boolean
  scrollClassName?: string
  className?: string
}

export function ThreadsInboxPanel({
  unreadReplies,
  unreadActivityCount,
  tab,
  loading,
  activityNotifications,
  messageGroups,
  onTabChange,
  onNavigate,
  title = "Threads",
  onClose,
  showFooterLink = false,
  scrollClassName,
  className,
}: ThreadsInboxPanelProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-foreground hover:bg-muted"
            aria-label="Close"
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
          aria-label="Threads activity and replies"
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
            {unreadReplies > 0 ? (
              <span className="tabular-nums text-[12px] font-medium text-muted-foreground">
                ({unreadReplies > 99 ? "99+" : unreadReplies})
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
          activityNotifications.length === 0 ? (
            <ThreadsInboxEmptyState tab="activity" />
          ) : (
            <ul className="divide-y divide-border/50">
              {activityNotifications.map((notification) => {
                const href = forumNotificationHref(notification)
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(href)}
                      className={cn(
                        "flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50",
                        !notification.is_read && "bg-[#5574AD]/5",
                      )}
                    >
                      <MessageProfileAvatar
                        avatarUrl={notification.actor?.avatar_url ?? null}
                        displayName={actorDisplayName(notification)}
                        className="h-10 w-10 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        {notification.thread?.title ? (
                          <p className="truncate text-[12px] font-medium text-muted-foreground">
                            {notification.thread.title}
                          </p>
                        ) : null}
                        <div className="mt-0.5 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="mr-1.5 inline-flex rounded-full bg-muted/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground ring-1 ring-border/40">
                              {forumActivityKindLabel(notification.type)}
                            </span>
                            <span className="text-[13px] font-medium leading-snug text-foreground">
                              {notification.message || "New activity on Threads"}
                            </span>
                          </div>
                          <time
                            className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                            dateTime={notification.created_at}
                          >
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                            })}
                          </time>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        ) : messageGroups.length === 0 ? (
          <ThreadsInboxEmptyState tab="messages" />
        ) : (
          <ul className="divide-y divide-border/50">
            {messageGroups.map((group) => {
              const href = forumNotificationHref(group.latestNotification)
              const actor = actorDisplayName(group.latestNotification)
              return (
                <li key={group.threadId}>
                  <button
                    type="button"
                    onClick={() => onNavigate(href)}
                    className={cn(
                      "flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50",
                      group.totalUnread > 0 && "bg-[#5574AD]/5",
                    )}
                  >
                    <MessageProfileAvatar
                      avatarUrl={group.latestNotification.actor?.avatar_url ?? null}
                      displayName={actor}
                      className="h-10 w-10 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {group.threadTitle}
                        </p>
                        <time
                          className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                          dateTime={group.latestNotification.created_at}
                        >
                          {formatDistanceToNow(new Date(group.latestNotification.created_at), {
                            addSuffix: true,
                          })}
                        </time>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                        <span className="font-medium text-foreground">{actor}</span>
                        {": "}
                        {group.latestNotification.message || "New reply"}
                      </p>
                      {group.totalUnread > 0 ? (
                        <p className="mt-1 text-[11px] font-medium text-[#5574AD]">
                          {group.totalUnread} unread{" "}
                          {group.totalUnread === 1 ? "reply" : "replies"}
                        </p>
                      ) : null}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {showFooterLink ? (
        <div className="shrink-0 border-t border-border/70 px-3 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-center rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/threads/messages">See all messages &amp; activity</Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

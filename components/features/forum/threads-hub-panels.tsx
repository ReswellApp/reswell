"use client"

import Link from "next/link"
import { Bell, PenSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { capitalizeWords } from "@/lib/listing-labels"
import type { BoardTalkForumThread } from "@/lib/services/forumThreads"
import { formatForumActivityTime } from "@/lib/utils/format-forum-activity-time"
import { ThreadsParticipantStack } from "@/components/features/forum/threads-participant-stack"
import { cn } from "@/lib/utils"

type ThreadsLatestPanelProps = {
  threads: BoardTalkForumThread[]
  className?: string
}

export function ThreadsLatestPanel({ threads, className }: ThreadsLatestPanelProps) {
  const latest = threads.slice(0, 10)

  return (
    <aside
      className={cn(
        "rounded-xl border border-border/60 bg-card shadow-sm",
        className,
      )}
    >
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Latest</h2>
      </div>
      {latest.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No recent activity yet.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {latest.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`/threads/${thread.slug}`}
                className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <ThreadsParticipantStack
                  participants={
                    thread.participants.length > 0
                      ? thread.participants
                      : [
                          {
                            userId: thread.id,
                            displayName: thread.authorName,
                            avatarUrl: thread.authorAvatarUrl,
                          },
                        ]
                  }
                  max={1}
                  size="md"
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                    {capitalizeWords(thread.title)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {thread.commentCount} {thread.commentCount === 1 ? "reply" : "replies"}
                    {" · "}
                    {formatForumActivityTime(thread.updatedAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

type ThreadsHubToolbarProps = {
  onNewTopic: () => void
}

export function ThreadsHubToolbar({ onNewTopic }: ThreadsHubToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        className="gap-2 rounded-md bg-[#3d4f63] px-4 shadow-sm hover:bg-[#334456]"
        onClick={onNewTopic}
      >
        <PenSquare className="h-4 w-4" aria-hidden />
        New topic
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0 rounded-md border-border/70 bg-card"
        aria-label="Notifications (coming soon)"
        disabled
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  )
}

function statClass(value: number, threshold: number): string {
  return value >= threshold ? "font-semibold text-[#e8622a]" : "text-muted-foreground"
}

type ThreadsTopicTableProps = {
  threads: BoardTalkForumThread[]
}

export function ThreadsTopicTable({ threads }: ThreadsTopicTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div
        className="hidden grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_4.5rem] gap-3 bg-[#3d4f63] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white sm:grid"
        aria-hidden
      >
        <span>Topic</span>
        <span className="text-right">Replies</span>
        <span className="text-right">Stoke</span>
        <span className="text-right">Activity</span>
      </div>
      <ul className="divide-y divide-border/50">
        {threads.map((thread) => (
          <li key={thread.id}>
            <Link
              href={`/threads/${thread.slug}`}
              className="grid grid-cols-1 gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_4.5rem] sm:items-center sm:py-3.5"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold leading-snug text-foreground">
                    {capitalizeWords(thread.title)}
                  </p>
                  {thread.bodyExcerpt ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{thread.bodyExcerpt}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground sm:hidden">
                    {thread.commentCount} replies · {formatForumActivityTime(thread.updatedAt)}
                  </p>
                </div>
                <ThreadsParticipantStack
                  participants={
                    thread.participants.length > 0
                      ? thread.participants
                      : [
                          {
                            userId: thread.id,
                            displayName: thread.authorName,
                            avatarUrl: thread.authorAvatarUrl,
                          },
                        ]
                  }
                  className="shrink-0 pt-0.5"
                />
              </div>
              <p className={cn("hidden text-right tabular-nums sm:block", statClass(thread.commentCount, 15))}>
                {thread.commentCount}
              </p>
              <p className={cn("hidden text-right tabular-nums sm:block", statClass(thread.likeCount, 10))}>
                {thread.likeCount}
              </p>
              <p className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
                {formatForumActivityTime(thread.updatedAt)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

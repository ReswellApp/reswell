"use client"

import type { ReactNode } from "react"
import { Link2, MoreHorizontal, Reply } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThreadsParticipantStack } from "@/components/features/forum/threads-participant-stack"
import { threadsLikeBadgeClassName } from "@/components/features/forum/threads-brand-styles"
import type { ForumThreadParticipant } from "@/lib/services/forumThreads"
import { cn } from "@/lib/utils"

type ThreadPostEngagementFooterProps = {
  replyCount: number
  likeCount: number
  linkCount: number
  participantCount: number
  participants: ForumThreadParticipant[]
  onReply: () => void
  onShare: () => void
  likeControl: ReactNode
  adminMenu?: ReactNode
  className?: string
}

function StatCell({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[3.5rem]">
      <p className="text-base font-semibold tabular-nums text-foreground sm:text-lg">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

export function ThreadPostEngagementFooter({
  replyCount,
  likeCount,
  linkCount,
  participantCount,
  participants,
  onReply,
  onShare,
  likeControl,
  adminMenu,
  className,
}: ThreadPostEngagementFooterProps) {
  return (
    <div className={cn("border-t border-border/60", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {likeCount > 0 ? (
            <>
              <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full text-base", threadsLikeBadgeClassName)}>
                ❤️
              </span>
              <span className="font-medium tabular-nums text-foreground">{likeCount}</span>
            </>
          ) : (
            <span className="text-xs">Be the first to show stoke</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <div className="[&_button]:h-9 [&_button]:rounded-md [&_button]:px-2">{likeControl}</div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={onShare}
            aria-label="Copy link"
          >
            <Link2 className="h-4 w-4" />
          </Button>
          {adminMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">{adminMenu}</DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 rounded-md px-3 text-muted-foreground hover:text-foreground"
            onClick={onReply}
          >
            <Reply className="h-4 w-4" aria-hidden />
            Reply
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/50 bg-muted/15 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap gap-x-6 gap-y-3 sm:gap-x-8">
          <StatCell value={replyCount} label={replyCount === 1 ? "reply" : "replies"} />
          <StatCell value={likeCount} label={likeCount === 1 ? "like" : "likes"} />
          <StatCell value={linkCount} label={linkCount === 1 ? "link" : "links"} />
          <StatCell value={participantCount} label={participantCount === 1 ? "user" : "users"} />
        </div>
        {participants.length > 0 ? (
          <ThreadsParticipantStack participants={participants} max={5} size="md" className="shrink-0" />
        ) : null}
      </div>
    </div>
  )
}

/** Compact stats strip for reply cards. */
export function ThreadCommentEngagementStrip({
  likeCount,
  replyCount,
  className,
}: {
  likeCount: number
  replyCount?: number
  className?: string
}) {
  if (likeCount === 0 && (replyCount ?? 0) === 0) return null

  return (
    <div
      className={cn(
        "mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 pt-3 text-xs text-muted-foreground",
        className,
      )}
    >
      {likeCount > 0 ? (
        <span>
          <span className="mr-1" aria-hidden>
            ❤️
          </span>
          <span className="font-medium tabular-nums text-foreground">{likeCount}</span>{" "}
          {likeCount === 1 ? "like" : "likes"}
        </span>
      ) : null}
      {replyCount != null && replyCount > 0 ? (
        <span>
          <span className="font-medium tabular-nums text-foreground">{replyCount}</span>{" "}
          {replyCount === 1 ? "reply" : "replies"}
        </span>
      ) : null}
    </div>
  )
}

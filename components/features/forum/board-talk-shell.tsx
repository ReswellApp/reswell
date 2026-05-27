"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  BoardTalkNav,
  getBoardTalkTab,
  isBoardTalkHubPath,
} from "@/components/features/forum/board-talk-nav"
import { BoardTalkPostReviewDialog } from "@/components/features/forum/board-talk-post-review-dialog"
import { BoardTalkReviewsUiProvider } from "@/components/features/forum/board-talk-reviews-ui-context"
import { cn } from "@/lib/utils"

type BoardTalkShellProps = {
  userId: string | null
  children: React.ReactNode
}

export function BoardTalkShell({ userId, children }: BoardTalkShellProps) {
  const pathname = usePathname()
  const isHub = isBoardTalkHubPath(pathname)
  const activeTab = getBoardTalkTab(pathname)
  const isReviewsTab = activeTab === "reviews"
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)

  const newPostHref = userId
    ? "/board-talk/new"
    : `/auth/login?redirect=${encodeURIComponent("/board-talk/new")}`

  const postReviewLoginHref = `/auth/login?redirect=${encodeURIComponent("/board-talk/reviews")}`

  const reviewsUi = useMemo(
    () => ({
      openPostReview: () => setReviewDialogOpen(true),
    }),
    [],
  )

  return (
    <>
      <header
        className={cn(
          "border-b border-border/60",
          isHub ? "pb-10 sm:pb-12" : "pb-6 sm:pb-8",
        )}
      >
        <div className="flex flex-col gap-6 sm:gap-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
            <div className="min-w-0 space-y-3">
              <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Board Talk</h1>
              {isHub ? (
                <p className="max-w-xl text-muted-foreground leading-relaxed">
                  Start a conversation, share stoke, and jump into what the community is talking about.
                </p>
              ) : null}
            </div>
            <div className="shrink-0 sm:pt-1">
              {isReviewsTab ? (
                userId ? (
                  <Button
                    type="button"
                    className="w-full min-h-touch sm:w-auto"
                    onClick={() => setReviewDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Post review
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="w-full min-h-touch sm:w-auto">
                    <Link href={postReviewLoginHref}>Log in to post a review</Link>
                  </Button>
                )
              ) : userId ? (
                <Button asChild className="w-full min-h-touch sm:w-auto">
                  <Link href={newPostHref}>
                    <Plus className="mr-2 h-4 w-4" />
                    New post
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="w-full min-h-touch sm:w-auto">
                  <Link href={newPostHref}>Log in to post</Link>
                </Button>
              )}
            </div>
          </div>
          <BoardTalkNav />
        </div>
      </header>
      <BoardTalkReviewsUiProvider value={isReviewsTab ? reviewsUi : null}>
        <div className={cn(isHub ? "mt-10 sm:mt-12" : "mt-8 sm:mt-10")}>{children}</div>
      </BoardTalkReviewsUiProvider>
      {isReviewsTab && userId ? (
        <BoardTalkPostReviewDialog
          userId={userId}
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
        />
      ) : null}
    </>
  )
}

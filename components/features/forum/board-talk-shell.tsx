"use client"

import { Suspense, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { BoardTalkChrome } from "@/components/features/forum/board-talk-chrome"
import { BoardTalkPresenceBar } from "@/components/features/forum/board-talk-presence-bar"
import { NewThreadDialog } from "@/components/features/forum/new-thread-dialog"
import { BoardTalkPostReviewDialog } from "@/components/features/forum/board-talk-post-review-dialog"
import { BoardTalkReviewsUiProvider } from "@/components/features/forum/board-talk-reviews-ui-context"
import { BoardTalkForumsUiProvider } from "@/components/features/forum/board-talk-forums-ui-context"
import { ThreadsBreadcrumbProvider } from "@/components/features/forum/threads-breadcrumb-provider"
import { useAuthModal } from "@/components/auth/auth-modal-context"
import { getBoardTalkTab } from "@/components/features/forum/board-talk-nav"
import { cn } from "@/lib/utils"

type BoardTalkShellProps = {
  userId: string | null
  displayName: string | null
  avatarUrl: string | null
  children: React.ReactNode
}

export function BoardTalkShell({
  userId,
  displayName,
  avatarUrl,
  children,
}: BoardTalkShellProps) {
  const pathname = usePathname()
  const authModal = useAuthModal()
  const activeTab = getBoardTalkTab(pathname)
  const isReviewsTab = activeTab === "reviews"
  const isForumsHub = activeTab === "forums"
  const isThreadDetail = pathname.startsWith("/threads/") && !isReviewsTab && pathname !== "/threads/new"
  const [threadDialogOpen, setThreadDialogOpen] = useState(false)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)

  const reviewsUi = useMemo(
    () => ({
      openPostReview: () => {
        if (!userId) {
          authModal.openLogin("/threads/reviews")
          return
        }
        setReviewDialogOpen(true)
      },
    }),
    [userId, authModal],
  )

  function openNewThread() {
    if (!userId) {
      authModal.openLogin("/threads")
      return
    }
    setThreadDialogOpen(true)
  }

  return (
    <div className="relative min-h-dvh bg-[#e9ede6] dark:bg-background">
      <BoardTalkChrome userId={userId} displayName={displayName} avatarUrl={avatarUrl} />

      <div
        className={cn(
          "mx-auto px-4 pb-16 sm:px-6 sm:pb-20",
          isForumsHub ? "max-w-6xl pt-6 sm:pt-8" : "max-w-4xl pt-6 sm:pt-8",
          isThreadDetail && "max-w-3xl",
        )}
      >
        {isForumsHub ? (
          <div className="mb-6 space-y-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Threads</h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                Community discussions — read everything, jump in when you&apos;re ready.
              </p>
            </div>
            <BoardTalkPresenceBar userId={userId} displayName={displayName} />
          </div>
        ) : null}

        <Suspense fallback={null}>
          <ThreadsBreadcrumbProvider>
            <BoardTalkForumsUiProvider value={{ openNewThread }}>
              <BoardTalkReviewsUiProvider value={isReviewsTab ? reviewsUi : null}>
                {children}
              </BoardTalkReviewsUiProvider>
            </BoardTalkForumsUiProvider>
          </ThreadsBreadcrumbProvider>
        </Suspense>
      </div>

      <NewThreadDialog open={threadDialogOpen} onOpenChange={setThreadDialogOpen} />

      {isReviewsTab && userId ? (
        <BoardTalkPostReviewDialog
          userId={userId}
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
        />
      ) : null}
    </div>
  )
}

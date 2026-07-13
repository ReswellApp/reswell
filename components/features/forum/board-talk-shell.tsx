"use client"

import { Suspense, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { BoardTalkChrome } from "@/components/features/forum/board-talk-chrome"
import { NewThreadDialog } from "@/components/features/forum/new-thread-dialog"
import { BoardTalkPostReviewDialog } from "@/components/features/forum/board-talk-post-review-dialog"
import { BoardTalkReviewsUiProvider } from "@/components/features/forum/board-talk-reviews-ui-context"
import { BoardTalkForumsUiProvider } from "@/components/features/forum/board-talk-forums-ui-context"
import { ThreadsBreadcrumbProvider } from "@/components/features/forum/threads-breadcrumb-provider"
import { ThreadsSubheader } from "@/components/features/forum/threads-subheader"
import { ThreadsPresenceProvider } from "@/components/features/forum/threads-presence-context"
import { useAuthModal } from "@/components/auth/auth-modal-context"
import { getBoardTalkTab } from "@/components/features/forum/board-talk-nav"
import { threadsPageBgClassName } from "@/components/features/forum/threads-brand-styles"
import { cn } from "@/lib/utils"

type BoardTalkShellProps = {
  userId: string | null
  displayName: string | null
  avatarUrl: string | null
  email: string | null
  threadsUnreadReplies: number
  children: React.ReactNode
}

export function BoardTalkShell({
  userId,
  displayName,
  avatarUrl,
  email,
  threadsUnreadReplies,
  children,
}: BoardTalkShellProps) {
  const pathname = usePathname()
  const authModal = useAuthModal()
  const activeTab = getBoardTalkTab(pathname)
  const isReviewsTab = activeTab === "reviews"
  const isProfilePage = pathname === "/threads/profile"
  const isMessagesPage = pathname === "/threads/messages"
  const isUtilityPage = isProfilePage || isMessagesPage
  const isThreadDetail =
    pathname.startsWith("/threads/") &&
    !isReviewsTab &&
    pathname !== "/threads/new" &&
    !isUtilityPage
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

  function openPostReview() {
    if (!userId) {
      authModal.openLogin("/threads/reviews")
      return
    }
    setReviewDialogOpen(true)
  }

  return (
    <div className={cn("relative min-h-dvh", threadsPageBgClassName)}>
      <ThreadsPresenceProvider userId={userId} displayName={displayName}>
        <BoardTalkChrome
          userId={userId}
          displayName={displayName}
          avatarUrl={avatarUrl}
          email={email}
          threadsUnreadReplies={threadsUnreadReplies}
          onNewTopic={openNewThread}
          onPostReview={openPostReview}
        />

        <Suspense fallback={null}>
          <ThreadsBreadcrumbProvider>
            <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
              <ThreadsSubheader onNewTopic={openNewThread} />
            </div>

            <div
              className={cn(
                "mx-auto px-4 pb-16 sm:px-6 sm:pb-20",
                isThreadDetail || isUtilityPage ? "max-w-3xl" : "max-w-6xl",
              )}
            >
              <BoardTalkForumsUiProvider value={{ openNewThread }}>
                <BoardTalkReviewsUiProvider value={isReviewsTab ? reviewsUi : null}>
                  {children}
                </BoardTalkReviewsUiProvider>
              </BoardTalkForumsUiProvider>
            </div>
          </ThreadsBreadcrumbProvider>
        </Suspense>

        <NewThreadDialog open={threadDialogOpen} onOpenChange={setThreadDialogOpen} />

        {userId ? (
          <BoardTalkPostReviewDialog
            userId={userId}
            open={reviewDialogOpen}
            onOpenChange={setReviewDialogOpen}
          />
        ) : null}
      </ThreadsPresenceProvider>
    </div>
  )
}

"use client"

import { Button } from "@/components/ui/button"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"
import { useAuthModal } from "@/components/auth/auth-modal-context"
import { ThreadsAccountMenu } from "@/components/features/forum/threads-account-menu"
import { ThreadsNotificationsBell } from "@/components/features/forum/threads-notifications-bell"
import { cn } from "@/lib/utils"

type BoardTalkChromeProps = {
  userId: string | null
  displayName: string | null
  avatarUrl: string | null
  email?: string | null
  threadsUnreadReplies?: number
  onNewTopic: () => void
  onPostReview: () => void
  className?: string
}

export function BoardTalkChrome({
  userId,
  displayName,
  avatarUrl,
  email,
  threadsUnreadReplies = 0,
  onNewTopic,
  onPostReview,
  className,
}: BoardTalkChromeProps) {
  const authModal = useAuthModal()
  const name = displayName?.trim() || "Member"

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <SiteWordmarkLink href="/threads" className="-ml-2 px-1 sm:px-2" />
        <div className="flex items-center gap-2 sm:gap-3">
          <ThreadsNotificationsBell userId={userId} unreadReplies={threadsUnreadReplies} />
          {userId ? (
            <ThreadsAccountMenu
              displayName={name}
              avatarUrl={avatarUrl}
              email={email}
              onNewTopic={onNewTopic}
              onPostReview={onPostReview}
            />
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-touch rounded-full px-4"
                onClick={() => authModal.openLogin(null)}
              >
                Log in
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-touch rounded-full px-4"
                onClick={() => authModal.openSignUp(null)}
              >
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  ThreadsNotificationsDropdown,
  dispatchThreadsUnreadCountRefresh,
} from "@/components/features/forum/threads-notifications-dropdown"
import { useAuthModal } from "@/components/auth/auth-modal-context"
import { getThreadsUnreadReplyCount } from "@/app/actions/threads-inbox"
import { cn } from "@/lib/utils"

type ThreadsNotificationsBellProps = {
  userId: string | null
  unreadReplies: number
  className?: string
}

export function ThreadsNotificationsBell({
  userId,
  unreadReplies,
  className,
}: ThreadsNotificationsBellProps) {
  const authModal = useAuthModal()
  const pathname = usePathname()
  const loginReturnPath = pathname?.startsWith("/threads") ? pathname : "/threads"
  const [liveUnreadReplies, setLiveUnreadReplies] = useState(unreadReplies)

  useEffect(() => {
    setLiveUnreadReplies(unreadReplies)
  }, [unreadReplies])

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) return
    const count = await getThreadsUnreadReplyCount(userId)
    setLiveUnreadReplies(count)
  }, [userId])

  useEffect(() => {
    if (!userId) return

    function onThreadsUnreadRefresh() {
      void refreshUnreadCount()
    }

    window.addEventListener("threadsUnreadCountRefresh", onThreadsUnreadRefresh)
    return () => window.removeEventListener("threadsUnreadCountRefresh", onThreadsUnreadRefresh)
  }, [refreshUnreadCount, userId])

  if (!userId) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          "relative h-10 w-10 shrink-0 rounded-full border-border/70 bg-card shadow-sm hover:bg-muted/60",
          className,
        )}
        aria-label="Threads notifications"
        onClick={() => authModal.openLogin(loginReturnPath)}
      >
        <Bell className="h-[18px] w-[18px] text-muted-foreground" aria-hidden />
      </Button>
    )
  }

  return (
    <ThreadsNotificationsDropdown
      unreadReplies={liveUnreadReplies}
      triggerClassName={cn(
        "h-10 w-10 shrink-0 rounded-full border border-border/70 bg-card shadow-sm hover:bg-muted/60",
        className,
      )}
      iconClassName="h-[18px] w-[18px] text-muted-foreground"
    />
  )
}

export { dispatchThreadsUnreadCountRefresh }

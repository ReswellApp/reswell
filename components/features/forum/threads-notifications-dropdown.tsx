"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { NavUnreadCountBadge } from "@/components/nav-unread-count-badge"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  ThreadsInboxPanel,
  useThreadsInbox,
} from "@/components/features/forum/threads-inbox-panel"
import { cn } from "@/lib/utils"

type ThreadsNotificationsDropdownProps = {
  unreadReplies: number
  triggerClassName?: string
  iconClassName?: string
}

export { dispatchThreadsUnreadCountRefresh } from "@/components/features/forum/threads-inbox-panel"

export function ThreadsNotificationsDropdown({
  unreadReplies,
  triggerClassName,
  iconClassName,
}: ThreadsNotificationsDropdownProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  const inbox = useThreadsInbox({
    enabled: open,
    initialUnreadReplies: unreadReplies,
    groupLimit: 8,
  })

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next && inbox.tab === "activity" && inbox.unreadActivityCount > 0) {
        void inbox.markTabRead("activity")
      }
    },
    [inbox.tab, inbox.unreadActivityCount, inbox.markTabRead],
  )

  const navigateAndClose = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  const panelProps = {
    unreadReplies: inbox.liveUnreadReplies,
    unreadActivityCount: inbox.unreadActivityCount,
    tab: inbox.tab,
    loading: inbox.loading,
    activityNotifications: inbox.activityNotifications.slice(0, 8),
    messageGroups: inbox.messageGroups,
    onTabChange: inbox.handleTabChange,
    onNavigate: navigateAndClose,
    showFooterLink: true,
  }

  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative text-foreground hover:bg-black/5 md:hover:bg-muted", triggerClassName)}
      aria-label="Threads notifications"
      aria-expanded={open}
      onClick={isMobile ? () => handleOpenChange(true) : undefined}
    >
      <Bell className={cn("h-6 w-6", iconClassName)} />
      <NavUnreadCountBadge count={inbox.liveUnreadReplies} overlay />
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
            <ThreadsInboxPanel
              {...panelProps}
              onClose={() => setOpen(false)}
              scrollClassName="flex-1"
              className="h-full"
            />
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
        <ThreadsInboxPanel {...panelProps} scrollClassName="max-h-[min(60vh,420px)]" />
      </PopoverContent>
    </Popover>
  )
}

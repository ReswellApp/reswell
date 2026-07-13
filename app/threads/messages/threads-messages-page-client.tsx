"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthModal } from "@/components/auth/auth-modal-context"
import {
  ThreadsInboxPanel,
  useThreadsInbox,
  type ThreadsInboxTab,
} from "@/components/features/forum/threads-inbox-panel"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type ThreadsMessagesPageClientProps = {
  initialUnreadReplies: number
}

function tabFromSearchParam(value: string | null): ThreadsInboxTab {
  return value === "activity" ? "activity" : "messages"
}

export function ThreadsMessagesPageClient({ initialUnreadReplies }: ThreadsMessagesPageClientProps) {
  const authModal = useAuthModal()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = tabFromSearchParam(searchParams.get("tab"))

  const inbox = useThreadsInbox({
    enabled: true,
    initialUnreadReplies,
    initialTab,
    groupLimit: 50,
  })

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        authModal.openLogin("/threads/messages")
      }
    })()
  }, [authModal])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Messages &amp; activity
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Replies and stokes from Threads — nothing from the marketplace inbox.
        </p>
      </header>

      <div className={cn("overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm")}>
        <ThreadsInboxPanel
          unreadReplies={inbox.liveUnreadReplies}
          unreadActivityCount={inbox.unreadActivityCount}
          tab={inbox.tab}
          loading={inbox.loading}
          activityNotifications={inbox.activityNotifications}
          messageGroups={inbox.messageGroups}
          onTabChange={inbox.handleTabChange}
          onNavigate={(href) => router.push(href)}
          title="Inbox"
          scrollClassName="max-h-none"
        />
      </div>
    </div>
  )
}

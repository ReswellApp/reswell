import type { Metadata } from "next"
import { Suspense } from "react"
import { ThreadsMessagesPageClient } from "@/app/threads/messages/threads-messages-page-client"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { countForumUnreadRepliesForUser } from "@/lib/db/forum-notifications-inbox"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata: Metadata = pageSeoMetadata({
  title: "Messages · Threads · Reswell",
  description: "View replies and activity notifications from Threads discussions.",
  path: "/threads/messages",
  robots: { index: false, follow: false },
})

export default async function ThreadsMessagesPage() {
  const { user } = await getCachedDashboardSession()
  const initialUnreadReplies = user ? await countForumUnreadRepliesForUser(user.id) : 0

  return (
    <Suspense fallback={null}>
      <ThreadsMessagesPageClient initialUnreadReplies={initialUnreadReplies} />
    </Suspense>
  )
}

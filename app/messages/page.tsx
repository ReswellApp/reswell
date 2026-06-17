import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { ensureMarketplaceThread } from "@/app/actions/messages"
import { MessagesChatSplit } from "@/components/features/messages/messages-chat-split"
import { MessagesEmptyPane } from "@/components/features/messages/messages-empty-pane"
import { MessagesInboxSkeleton } from "@/components/features/messages/messages-page-skeletons"

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; user?: string; listing?: string; seller?: string }>
}) {
  const params = await searchParams

  if (params.tab === "offers") {
    redirect("/messages/offers")
  }

  if (params.tab === "activity") {
    redirect("/messages")
  }

  const { user } = await getCachedRequestSession()

  if (!user) {
    redirect("/auth/login?redirect=/messages")
  }

  const userParam = params.user?.trim()
  const listingParam = params.listing?.trim()

  if (userParam && listingParam && userParam !== user.id) {
    const opened = await ensureMarketplaceThread({
      listing_id: listingParam,
      other_user_id: userParam,
    })

    if ("conversation_id" in opened && opened.conversation_id) {
      redirect(`/messages/${opened.conversation_id}`)
    }

    if ("compose" in opened && opened.compose) {
      redirect(
        `/messages/new?user=${encodeURIComponent(userParam)}&listing=${encodeURIComponent(listingParam)}`,
      )
    }
  }

  return (
    <Suspense fallback={<MessagesInboxSkeleton embedded />}>
      <MessagesChatSplit>
        <MessagesEmptyPane />
      </MessagesChatSplit>
    </Suspense>
  )
}

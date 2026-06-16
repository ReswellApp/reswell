import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCachedRequestSession } from '@/lib/auth/cached-request-session'
import { getCachedMessagesInbox } from '@/lib/cache/messages-inbox'
import { ensureMarketplaceThread } from '@/app/actions/messages'
import { MessagesInboxClient } from '@/components/features/messages/messages-inbox-client'
import { MessagesInboxSkeleton } from '@/components/features/messages/messages-page-skeletons'

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; user?: string; listing?: string }>
}) {
  const params = await searchParams
  const { user } = await getCachedRequestSession()

  if (!user) {
    redirect('/auth/login?redirect=/messages')
  }

  const userParam = params.user?.trim()
  const listingParam = params.listing?.trim()

  if (userParam && listingParam && userParam !== user.id) {
    const opened = await ensureMarketplaceThread({
      listing_id: listingParam,
      other_user_id: userParam,
    })

    if ('conversation_id' in opened && opened.conversation_id) {
      redirect(`/messages/${opened.conversation_id}`)
    }

    if ('compose' in opened && opened.compose) {
      redirect(
        `/messages/new?user=${encodeURIComponent(userParam)}&listing=${encodeURIComponent(listingParam)}`,
      )
    }
  }

  return (
    <Suspense fallback={<MessagesInboxSkeleton />}>
      <MessagesInboxData userId={user.id} />
    </Suspense>
  )
}

// Isolated async boundary so the inbox skeleton streams instantly while the
// (tag-cached) inbox query resolves, instead of blocking the whole route.
async function MessagesInboxData({ userId }: { userId: string }) {
  const inbox = await getCachedMessagesInbox(userId)

  return (
    <MessagesInboxClient
      currentUserId={userId}
      initialConversations={inbox.conversations}
      initialNotifications={inbox.notifications}
    />
  )
}

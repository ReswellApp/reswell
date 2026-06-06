import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCachedRequestSession } from '@/lib/auth/cached-request-session'
import { getCachedMessagesInbox } from '@/lib/cache/messages-inbox'
import { ensureMarketplaceThread } from '@/app/actions/messages'
import { MessagesInboxClient } from '@/components/features/messages/messages-inbox-client'
import { MessagesInboxRealtimeRefresh } from '@/components/features/messages/messages-inbox-realtime-refresh'
import { MessagesInboxSkeleton } from '@/components/features/messages/messages-page-skeletons'

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; user?: string; listing?: string }>
}) {
  const params = await searchParams
  const { user } = await getCachedRequestSession()

  if (!user) {
    return (
      <Suspense fallback={<MessagesInboxSkeleton />}>
        <MessagesInboxClient
          currentUserId={null}
          initialConversations={[]}
          initialNotifications={[]}
        />
      </Suspense>
    )
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

  const inbox = await getCachedMessagesInbox(user.id)

  return (
    <Suspense fallback={<MessagesInboxSkeleton />}>
      <MessagesInboxRealtimeRefresh userId={user.id} />
      <MessagesInboxClient
        currentUserId={user.id}
        initialConversations={inbox.conversations}
        initialNotifications={inbox.notifications}
      />
    </Suspense>
  )
}

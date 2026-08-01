import { unstable_cache } from "next/cache"
import type { MessagesInboxPayload } from "@/lib/db/messagesInbox"
import { getMessagesInboxForUser } from "@/lib/services/messagesInbox"

export const MESSAGES_INBOX_CACHE_KEY_PREFIX = "messages-inbox-v2"

export function messagesInboxTag(userId: string): string {
  return `${MESSAGES_INBOX_CACHE_KEY_PREFIX}:${userId}`
}

/**
 * Per-user inbox cache. Invalidated via `revalidateTag(messagesInboxTag(userId))` on new messages.
 * Uses the service layer so support-ticket DMs stay out of marketplace Messages.
 */
export async function getCachedMessagesInbox(userId: string): Promise<MessagesInboxPayload> {
  if (process.env.NODE_ENV === "development") {
    return getMessagesInboxForUser(userId)
  }

  const loader = unstable_cache(
    async (): Promise<MessagesInboxPayload> => getMessagesInboxForUser(userId),
    [MESSAGES_INBOX_CACHE_KEY_PREFIX, userId],
    {
      tags: [messagesInboxTag(userId)],
      revalidate: false,
    },
  )

  return loader()
}

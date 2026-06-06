import { unstable_cache } from "next/cache"
import { loadMessagesInboxForUser, type MessagesInboxPayload } from "@/lib/db/messagesInbox"

export const MESSAGES_INBOX_CACHE_KEY_PREFIX = "messages-inbox-v1"

export function messagesInboxTag(userId: string): string {
  return `${MESSAGES_INBOX_CACHE_KEY_PREFIX}:${userId}`
}

/**
 * Per-user inbox cache. Invalidated via `revalidateTag(messagesInboxTag(userId))` on new messages.
 */
export async function getCachedMessagesInbox(userId: string): Promise<MessagesInboxPayload> {
  if (process.env.NODE_ENV === "development") {
    return loadMessagesInboxForUser(userId)
  }

  const loader = unstable_cache(
    async (): Promise<MessagesInboxPayload> => loadMessagesInboxForUser(userId),
    [MESSAGES_INBOX_CACHE_KEY_PREFIX, userId],
    {
      tags: [messagesInboxTag(userId)],
      revalidate: false,
    },
  )

  return loader()
}

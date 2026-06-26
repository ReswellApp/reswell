import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { getCachedMessagesInbox } from "@/lib/cache/messages-inbox"
import { loadMessageSmsNotificationsStateForUser } from "@/lib/services/messageSmsNotifications"
import { MessagesInboxProvider } from "@/components/features/messages/messages-inbox-context"

export const metadata = privatePageMetadata({
  title: "Messages — Reswell",
  description: "Open your inbox to reply to buyers and sellers about surfboard listings and offers.",
  path: "/messages",
})

/** Personal inbox inside the consignment store hub — store layout provides chrome. */
export default async function StoreAccountMessagesLayout({ children }: { children: ReactNode }) {
  const { user } = await getCachedRequestSession()
  const inbox = user ? await getCachedMessagesInbox(user.id) : null
  const smsState = user
    ? await loadMessageSmsNotificationsStateForUser(user.id, user.phone)
    : null

  if (user && inbox) {
    return (
      <MessagesInboxProvider
        userId={user.id}
        initialConversations={inbox.conversations}
        initialNotifications={inbox.notifications}
        initialMessageSmsOptIn={smsState?.message_sms_opt_in ?? false}
        initialHasSmsPhone={smsState?.has_phone ?? false}
        initialSmsPhone={smsState?.phone ?? null}
      >
        {children}
      </MessagesInboxProvider>
    )
  }

  return children
}

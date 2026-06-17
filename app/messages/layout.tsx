import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { getCachedMessagesInbox } from "@/lib/cache/messages-inbox"
import { loadMessageSmsNotificationsStateForUser } from "@/lib/services/messageSmsNotifications"
import { MessagesAccountShell } from "@/components/features/messages/messages-account-shell"
import { MessagesInboxProvider } from "@/components/features/messages/messages-inbox-context"

export const metadata = privatePageMetadata({
  title: "Messages — Reswell",
  description: "Open your inbox to reply to buyers and sellers about surfboard listings and offers.",
  path: "/messages",
})

export default async function MessagesLayout({ children }: { children: ReactNode }) {
  const { user } = await getCachedRequestSession()
  const inbox = user ? await getCachedMessagesInbox(user.id) : null
  const smsState = user
    ? await loadMessageSmsNotificationsStateForUser(user.id, user.phone)
    : null

  return (
    <MessagesAccountShell>
      {user && inbox ? (
        <MessagesInboxProvider
          userId={user.id}
          initialConversations={inbox.conversations}
          initialNotifications={inbox.notifications}
          initialMessageSmsOptIn={smsState?.message_sms_opt_in ?? false}
          initialHasSmsPhone={smsState?.has_phone ?? false}
        >
          {children}
        </MessagesInboxProvider>
      ) : (
        children
      )}
    </MessagesAccountShell>
  )
}

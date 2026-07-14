import { notFound, redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { getUserSupportTicketService } from "@/lib/services/userSupportTickets"
import { loadConversationThread } from "@/app/actions/messages"
import { ConversationThreadClient } from "@/components/features/messages/conversation-thread-client"
import {
  SupportTicketDetailHeader,
  SupportTicketThreadPending,
} from "@/components/features/dashboard/support/support-ticket-detail-header"
import { supportTicketDisplaySubject } from "@/lib/utils/support-ticket-display"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user } = await getCachedDashboardSession()
  if (!user) {
    return privatePageMetadata({
      title: "Support — Reswell",
      description: "View your support request and conversation with the Reswell team.",
      path: `/dashboard/support/${id}`,
    })
  }

  const ticket = await getUserSupportTicketService(user.id, id)
  const subject = ticket
    ? supportTicketDisplaySubject(ticket.subject, ticket.source)
    : "Support request"

  return privatePageMetadata({
    title: `${subject} — Support — Reswell`,
    description: "View your support request and conversation with the Reswell team.",
    path: `/dashboard/support/${id}`,
  })
}

export default async function DashboardSupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user } = await getCachedDashboardSession()

  if (!user) {
    redirect(`/auth/login?redirect=/dashboard/support/${id}`)
  }

  const ticket = await getUserSupportTicketService(user.id, id)
  if (!ticket) {
    notFound()
  }

  const threadResult = ticket.support_conversation_id
    ? await loadConversationThread(ticket.support_conversation_id)
    : null

  return (
    <div className="space-y-6">
      <SupportTicketDetailHeader ticket={ticket} />

      {ticket.support_conversation_id && threadResult && !("error" in threadResult) ? (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm">
          <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-sm font-medium text-foreground">Conversation with Reswell Support</p>
            <p className="text-xs text-muted-foreground">
              Replies here go directly to our support team. You&apos;ll also get email updates for important
              changes.
            </p>
          </div>
          <div className="min-h-[420px] max-h-[min(72vh,720px)]">
            <ConversationThreadClient
              key={ticket.support_conversation_id}
              conversationId={ticket.support_conversation_id}
              initialData={threadResult}
              embedded
              backHref={`/dashboard/support/${ticket.id}`}
            />
          </div>
        </div>
      ) : (
        <SupportTicketThreadPending ticket={ticket} />
      )}
    </div>
  )
}

import { notFound, redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { loadConversationThread } from "@/app/actions/messages"
import { getUserSupportTicketService } from "@/lib/services/userSupportTickets"
import { getUserOrderSupportCaseService } from "@/lib/services/supportCases"
import { SupportCaseResponseView } from "@/components/features/support/support-case-response-view"
import {
  contactStatusToCaseStatus,
  orderRequestTypeSubject,
  orderRequestTypeToKind,
  orderSupportStatusToCaseStatus,
} from "@/lib/utils/support-case-display"
import { supportTicketDisplaySubject } from "@/lib/utils/support-ticket-display"
import { supportCaseResponseHref } from "@/lib/utils/support-case-paths"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return privatePageMetadata({
    title: "Support case — Reswell",
    description: "Reply to Reswell Support about your help case.",
    path: supportCaseResponseHref(id),
  })
}

export default async function SupportCaseResponsePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user } = await getCachedDashboardSession()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(supportCaseResponseHref(id))}`)
  }

  const orderRow = await getUserOrderSupportCaseService(user.id, id)
  if (orderRow) {
    const threadResult = orderRow.support_conversation_id
      ? await loadConversationThread(orderRow.support_conversation_id)
      : null
    const threadData =
      threadResult && !("error" in threadResult) ? threadResult : null
    const purchaseHref =
      orderRow.requester_role === "seller"
        ? `/dashboard/sales/${orderRow.order_id}`
        : `/dashboard/purchases/${orderRow.order_id}`

    return (
      <SupportCaseResponseView
        caseId={orderRow.id}
        subject={orderRequestTypeSubject(orderRow.request_type, orderRow.order_ref)}
        kind={orderRequestTypeToKind(orderRow.request_type)}
        status={orderSupportStatusToCaseStatus(orderRow.support_status)}
        preview={orderRow.body}
        orderId={orderRow.order_id}
        orderRef={orderRow.order_ref}
        orderHref={purchaseHref}
        createdAt={orderRow.created_at}
        conversationId={orderRow.support_conversation_id}
        threadData={threadData}
        repairCreditTotal={orderRow.repair_credit_total ?? 0}
      />
    )
  }

  const ticket = await getUserSupportTicketService(user.id, id)
  if (!ticket) notFound()

  const threadResult = ticket.support_conversation_id
    ? await loadConversationThread(ticket.support_conversation_id)
    : null
  const threadData = threadResult && !("error" in threadResult) ? threadResult : null

  return (
    <SupportCaseResponseView
      caseId={ticket.id}
      subject={supportTicketDisplaySubject(ticket.subject, ticket.source)}
      kind="general"
      status={contactStatusToCaseStatus(ticket.support_status)}
      preview={ticket.message}
      orderId={null}
      orderRef={null}
      orderHref={null}
      createdAt={ticket.created_at}
      conversationId={ticket.support_conversation_id}
      threadData={threadData}
    />
  )
}

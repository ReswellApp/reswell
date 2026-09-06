import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import {
  getOrderSupportRequestById,
} from "@/lib/db/order-support"
import {
  CONTACT_MESSAGE_ADMIN_SELECT,
  normalizeContactMessageRow,
} from "@/lib/db/contactMessages"
import { AdminSupportCaseDesk } from "@/components/features/admin/admin-support-case-desk"
import { adminSupportCaseHref } from "@/lib/utils/support-case-paths"
import {
  formatSupportCaseReference,
  orderRequestTypeSubject,
  orderRequestTypeToKind,
} from "@/lib/utils/support-case-display"
import { supportTicketDisplaySubject } from "@/lib/utils/support-ticket-display"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return privatePageMetadata({
    title: `Support case ${formatSupportCaseReference(id)} — Admin — Reswell`,
    description: "Reply to a customer Help case thread.",
    path: adminSupportCaseHref(id),
  })
}

export default async function AdminSupportCasePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?redirect=${encodeURIComponent(adminSupportCaseHref(id))}`)

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    redirect("/admin")
  }

  const order = await getOrderSupportRequestById(supabase, id)
  if (order) {
    return (
      <AdminSupportCaseDesk
        backend="order_support"
        caseId={order.id}
        subject={orderRequestTypeSubject(order.request_type, order.order_ref)}
        kind={orderRequestTypeToKind(order.request_type)}
        customerUserId={order.buyer_id}
        customerLabel={`Buyer ${order.buyer_id.slice(0, 8)}…`}
        supportConversationId={order.support_conversation_id}
        orderId={order.order_id}
        orderRef={order.order_ref}
        preview={order.body}
        initialStatus={order.support_status}
      />
    )
  }

  const { data: cmRaw } = await supabase
    .from("contact_messages")
    .select(CONTACT_MESSAGE_ADMIN_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (!cmRaw) notFound()

  const ticket = normalizeContactMessageRow(cmRaw as Record<string, unknown>)

  return (
    <AdminSupportCaseDesk
      backend="contact_message"
      caseId={ticket.id}
      subject={supportTicketDisplaySubject(ticket.subject, ticket.source)}
      kind="general"
      customerUserId={ticket.user_id}
      customerLabel={ticket.name}
      supportConversationId={ticket.support_conversation_id}
      orderId={null}
      orderRef={null}
      preview={ticket.message}
      initialStatus={ticket.support_status}
    />
  )
}

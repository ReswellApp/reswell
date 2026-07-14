import { notFound } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getContactMessageTicketAdminService } from "@/lib/services/contactMessageTicketAdmin"
import { ContactMessageSupportThread } from "@/components/features/admin/contact-message-support-thread"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getContactMessageTicketAdminService(id)
  const subject =
    "data" in result && result.data
      ? result.data.ticket.subject?.trim() || "Support request"
      : "Support ticket"

  return privatePageMetadata({
    title: `${subject} — Support inbox — Admin — Reswell`,
    description: "Reply to a member support ticket in the same thread they see under Dashboard → Support.",
    path: `/admin/contact-messages/${id}`,
  })
}

export default async function AdminContactMessageTicketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getContactMessageTicketAdminService(id)

  if ("error" in result) {
    if (result.error === "Not found") {
      notFound()
    }
    return (
      <p className="text-sm text-destructive">
        {result.error === "Forbidden" || result.error === "Unauthorized"
          ? "You do not have access to this ticket."
          : "Could not load this ticket."}
      </p>
    )
  }

  return (
    <ContactMessageSupportThread
      initialTicket={result.data.ticket}
      supportUserId={result.data.supportUserId}
    />
  )
}

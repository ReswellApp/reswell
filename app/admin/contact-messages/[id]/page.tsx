import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { resolveAdminInboxHrefService } from "@/lib/services/adminSupportInbox"
import { adminSupportCaseHref } from "@/lib/utils/support-case-paths"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return privatePageMetadata({
    title: "Support ticket — Admin — Reswell",
    description: "Reply to a customer Help case in the support inbox.",
    path: adminSupportCaseHref(id),
  })
}

/** Legacy thread URL — inbox is the only composer. */
export default async function AdminContactMessageTicketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(await resolveAdminInboxHrefService(id))
}

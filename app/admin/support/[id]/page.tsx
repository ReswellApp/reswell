import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { resolveAdminInboxHrefService } from "@/lib/services/adminSupportInbox"
import { adminSupportCaseHref } from "@/lib/utils/support-case-paths"
import { formatSupportCaseReference } from "@/lib/utils/support-case-display"

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

/** Legacy desk URL — inbox is the only composer. */
export default async function AdminSupportCasePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(await resolveAdminInboxHrefService(id))
}

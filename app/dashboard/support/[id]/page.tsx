import { redirect } from "next/navigation"
import { supportCaseResponseHref } from "@/lib/utils/support-case-paths"

/** Legacy path — canonical response URL is `/support/[id]`. */
export default async function DashboardSupportTicketRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(supportCaseResponseHref(id))
}

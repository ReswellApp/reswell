import { notFound, redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { getSupportCaseThreadForMember } from "@/lib/services/supportCaseThread"
import { SupportCaseResponseView } from "@/components/features/support/support-case-response-view"
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

  const result = await getSupportCaseThreadForMember(user.id, id)
  if ("error" in result) notFound()

  const row = result.case
  const orderHref = row.order_id
    ? row.requester_role === "seller"
      ? `/dashboard/sales/${row.order_id}`
      : `/dashboard/purchases/${row.order_id}`
    : null

  return (
    <SupportCaseResponseView
      caseId={row.id}
      subject={row.subject}
      kind={row.kind}
      status={row.status}
      preview={row.preview}
      orderId={row.order_id}
      orderRef={row.order_ref}
      orderHref={orderHref}
      createdAt={row.created_at}
      messages={result.messages}
    />
  )
}

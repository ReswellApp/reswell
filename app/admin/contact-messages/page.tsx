import { Suspense } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { CaseInboxAdminClient } from "@/components/features/admin/case-inbox-admin-client"
import { CaseInboxWorkspaceSkeleton } from "@/components/features/admin/case-inbox-workspace-skeleton"
import { listAdminSupportInboxService } from "@/lib/services/adminSupportInbox"
import { getSupportCaseCustomerContextService } from "@/lib/services/supportCaseCustomerContext"
import { DEFAULT_INBOX_SORT, inboxViewFromSearchParams } from "@/lib/admin/case-inbox"
import { INBOX_PAGE_SIZE } from "@/lib/admin/case-inbox-query"
import { parseInboxCaseParam } from "@/lib/utils/support-case-paths"

export const metadata = privatePageMetadata({
  title: "Support tickets — Admin — Reswell",
  description: "Unified customer help cases — general, orders, and Purchase Protection claims.",
  path: "/admin/contact-messages",
})

export default async function AdminContactMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string
    status?: string
    type?: string
    assignee?: string
    tab?: string
    case?: string
  }>
}) {
  const params = await searchParams
  const parsed = inboxViewFromSearchParams({
    view: params.view ?? null,
    status: params.status ?? null,
    type: params.type ?? null,
    assignee: params.assignee ?? null,
    tab: params.tab ?? null,
  })

  const selectedCaseId = parseInboxCaseParam(params.case)
  const [initial, initialCustomer] = await Promise.all([
    listAdminSupportInboxService({
      view: parsed.view,
      type: parsed.typeOverlay,
      search: "",
      sort: DEFAULT_INBOX_SORT,
      offset: 0,
      limit: INBOX_PAGE_SIZE,
      selected_key: params.case ?? null,
    }),
    selectedCaseId
      ? getSupportCaseCustomerContextService({ case_id: selectedCaseId })
      : Promise.resolve(null),
  ])

  return (
    <Suspense fallback={<CaseInboxWorkspaceSkeleton />}>
      <CaseInboxAdminClient
        initialInbox={"error" in initial ? null : initial}
        initialError={"error" in initial ? initial.error : null}
        initialCustomerContext={
          initialCustomer && "data" in initialCustomer ? initialCustomer.data : null
        }
        initialCustomerCaseKey={params.case ?? null}
      />
    </Suspense>
  )
}

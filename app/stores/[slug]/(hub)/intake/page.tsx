import { getStoreHubContext } from "@/lib/store-hub-access"
import { listPendingIntakesForStore } from "@/lib/db/consignmentStores"
import { IntakeApprovalList } from "@/components/features/consignment/intake-approval-list"
import { StorePageHeader } from "@/components/features/consignment/store-page-header"
import { resolveStoreSectionMeta } from "@/lib/store-section-meta"

export default async function StoreIntakeApprovalPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { supabase, store } = await getStoreHubContext(slug)
  const { description } = resolveStoreSectionMeta(`/stores/${slug}/intake`, slug)

  const intakes = await listPendingIntakesForStore(supabase, store.id)

  return (
    <>
      <StorePageHeader title="Intake approvals" description={description} />
      <IntakeApprovalList intakes={intakes} defaultCommissionBps={store.defaultCommissionBps} />
    </>
  )
}

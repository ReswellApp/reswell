import { getStoreHubContext } from "@/lib/store-hub-access"
import { listStoreCustomers } from "@/lib/db/consignmentStores"
import { StoreCustomersPanel } from "@/components/features/consignment/store-customers-panel"
import { StorePageHeader } from "@/components/features/consignment/store-page-header"
import { resolveStoreSectionMeta } from "@/lib/store-section-meta"

export const dynamic = "force-dynamic"

export default async function StoreCustomersPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { supabase, store } = await getStoreHubContext(slug)
  const { description } = resolveStoreSectionMeta(`/stores/${slug}/customers`, slug)

  const customers = await listStoreCustomers(supabase, store.id)

  return (
    <>
      <StorePageHeader title="Customers" description={description} />
      <StoreCustomersPanel storeId={store.id} initialCustomers={customers} />
    </>
  )
}

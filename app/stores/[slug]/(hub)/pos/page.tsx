import { getStoreHubContext } from "@/lib/store-hub-access"
import { listActiveStoreInventory } from "@/lib/db/consignmentStores"
import { PosRegister } from "@/components/features/consignment/pos-register"
import { StorePageHeader } from "@/components/features/consignment/store-page-header"
import { resolveStoreSectionMeta } from "@/lib/store-section-meta"

export default async function StorePosPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { supabase, store } = await getStoreHubContext(slug)
  const { description } = resolveStoreSectionMeta(`/stores/${slug}/pos`, slug)

  const inventory = await listActiveStoreInventory(supabase, store.id)

  return (
    <>
      <StorePageHeader title="Register" description={description} />
      <PosRegister
        storeId={store.id}
        storeSlug={slug}
        storeName={store.name}
        initialInventory={inventory}
      />
    </>
  )
}

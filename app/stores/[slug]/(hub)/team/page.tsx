import { notFound } from "next/navigation"
import { getStoreHubContext } from "@/lib/store-hub-access"
import { listStoreStaff } from "@/lib/services/storeStaff"
import { StoreTeamManager } from "@/components/features/consignment/store-team-manager"
import { StorePageHeader } from "@/components/features/consignment/store-page-header"
import { resolveStoreSectionMeta } from "@/lib/store-section-meta"

export const dynamic = "force-dynamic"

export default async function StoreTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { store, role } = await getStoreHubContext(slug)
  if (role !== "owner") {
    notFound()
  }

  const { description } = resolveStoreSectionMeta(`/stores/${slug}/team`, slug)
  const result = await listStoreStaff(store.id)
  const members = result.ok ? result.staff : []

  return (
    <>
      <StorePageHeader title="Team" description={description} />
      <StoreTeamManager storeId={store.id} members={members} />
    </>
  )
}

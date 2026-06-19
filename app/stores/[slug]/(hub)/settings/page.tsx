import { notFound } from "next/navigation"
import { getStoreHubContext } from "@/lib/store-hub-access"
import { StoreSettingsForm } from "@/components/features/consignment/store-settings-form"
import { StorePageHeader } from "@/components/features/consignment/store-page-header"
import { resolveStoreSectionMeta } from "@/lib/store-section-meta"

export const dynamic = "force-dynamic"

export default async function StoreSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { store, role } = await getStoreHubContext(slug)
  if (role !== "owner") {
    notFound()
  }

  const { description } = resolveStoreSectionMeta(`/stores/${slug}/settings`, slug)

  return (
    <>
      <StorePageHeader title="Settings" description={description} />
      <StoreSettingsForm
        storeId={store.id}
        defaultCommissionBps={store.defaultCommissionBps}
        status={store.status === "paused" ? "paused" : "active"}
        stripeTerminalLocationId={store.stripeTerminalLocationId}
        reswellFeeBps={store.reswellFeeBps}
      />
    </>
  )
}

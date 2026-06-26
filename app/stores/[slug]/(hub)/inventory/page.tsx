import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getStoreHubContext } from "@/lib/store-hub-access"
import { listActiveStoreInventory, listUnattachedOwnerListingsForStore } from "@/lib/db/consignmentStores"
import { StoreInventoryList } from "@/components/features/consignment/store-inventory-list"
import { StoreAddExistingInventory } from "@/components/features/consignment/store-add-existing-inventory"
import { StorePageHeader } from "@/components/features/consignment/store-page-header"
import { reconcileStoreInventorySoldOrders } from "@/lib/services/reconcileListingSoldOrders"
import { resolveStoreSectionMeta } from "@/lib/store-section-meta"
import { storeNavHref } from "@/lib/store-nav-links"

export const dynamic = "force-dynamic"

export default async function StoreInventoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { supabase, store, role } = await getStoreHubContext(slug)
  const { description } = resolveStoreSectionMeta(`/stores/${slug}/inventory`, slug)

  const canReprice = role === "owner" || role === "manager"
  const canListShopItems = canReprice

  await reconcileStoreInventorySoldOrders(store.id)

  const [consignmentInventory, shopInventory, unattachedListings] = await Promise.all([
    listActiveStoreInventory(supabase, store.id, { kind: "consignment" }),
    listActiveStoreInventory(supabase, store.id, { kind: "shop_owned" }),
    canListShopItems
      ? listUnattachedOwnerListingsForStore(supabase, store.id, store.ownerProfileId)
      : Promise.resolve([]),
  ])

  return (
    <>
      <StorePageHeader title="Inventory" description={description} />

      {canListShopItems ? (
        <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
          <Button asChild size="sm">
            <Link href={`/sell?store=${encodeURIComponent(slug)}`}>
              <Plus className="mr-1.5 h-4 w-4" />
              List shop item
            </Link>
          </Button>
        </div>
      ) : null}

      {canListShopItems ? (
        <StoreAddExistingInventory storeSlug={slug} listings={unattachedListings} />
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Shop inventory</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {shopInventory.length} active
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Items you own and sell directly — boards, fins, and more on your shop account.
        </p>
        <StoreInventoryList
          items={shopInventory}
          storeSlug={slug}
          canReprice={canReprice}
          emptyMessage="No shop-owned items yet. List one or add from your seller profile above."
        />
      </section>

      <section className="mt-10 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Consignment inventory</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {consignmentInventory.length} active
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Boards consigned by surfers — you sell on their behalf and split proceeds on sale.
        </p>
        <StoreInventoryList
          items={consignmentInventory}
          storeSlug={slug}
          canReprice={canReprice}
          emptyMessage="No consigned boards on the floor. Share your intake QR to accept drop-offs."
        />
        {consignmentInventory.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            <Link href={storeNavHref(slug, "/qr")} className="underline underline-offset-2">
              Open intake QR
            </Link>
          </p>
        ) : null}
      </section>
    </>
  )
}

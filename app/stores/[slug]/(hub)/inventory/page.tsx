import Image from "next/image"
import Link from "next/link"
import { Printer } from "lucide-react"
import { getStoreHubContext } from "@/lib/store-hub-access"
import { listActiveStoreInventory } from "@/lib/db/consignmentStores"
import { StoreRepriceRow } from "@/components/features/consignment/store-reprice-row"
import { StoreListingActions } from "@/components/features/consignment/store-listing-actions"
import { StorePageHeader } from "@/components/features/consignment/store-page-header"
import { resolveStoreSectionMeta } from "@/lib/store-section-meta"

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
  const inventory = await listActiveStoreInventory(supabase, store.id)

  return (
    <>
      <StorePageHeader title="Inventory" description={description} />

      {inventory.length === 0 ? (
        <p className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
          No active boards.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {inventory.map((item) => (
            <li key={item.listingId} className="flex items-center gap-3 px-4 py-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {item.coverUrl ? (
                  <Image
                    src={item.coverUrl}
                    alt={item.title}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <Link
                  href={`/stores/${slug}/inventory/${item.listingId}/label`}
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Printer className="h-3 w-3" />
                  Label
                </Link>
              </div>
              <StoreRepriceRow
                listingId={item.listingId}
                price={item.price}
                floorPrice={item.floorPrice}
                canReprice={canReprice}
              />
              {canReprice ? (
                <StoreListingActions listingId={item.listingId} price={item.price} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

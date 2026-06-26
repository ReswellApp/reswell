import Image from "next/image"
import Link from "next/link"
import { Printer } from "lucide-react"
import type { StoreInventoryItem } from "@/lib/db/consignmentStores"
import { StoreRepriceRow } from "@/components/features/consignment/store-reprice-row"
import { StoreListingActions } from "@/components/features/consignment/store-listing-actions"

interface StoreInventoryListProps {
  items: StoreInventoryItem[]
  storeSlug: string
  canReprice: boolean
  emptyMessage: string
}

export function StoreInventoryList({
  items,
  storeSlug,
  canReprice,
  emptyMessage,
}: StoreInventoryListProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    )
  }

  return (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => (
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
              href={`/stores/${storeSlug}/inventory/${item.listingId}/label`}
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
            <StoreListingActions
              listingId={item.listingId}
              price={item.price}
              kind={item.kind}
            />
          ) : null}
        </li>
      ))}
    </ul>
  )
}

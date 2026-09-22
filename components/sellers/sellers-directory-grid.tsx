import {
  SellerDirectoryCard,
  type SellerDirectoryCardShop,
  type SellerDirectoryListingThumb,
} from "@/components/sellers/seller-directory-card"
import type { SellerDirectoryMosaicSlot } from "@/lib/sellers/directory-mosaic-images"
import type { SellerDirectoryTileMeta } from "@/lib/sellers/directory-tile-meta"

export type SellerDirectoryGridItem = {
  shop: SellerDirectoryCardShop
  thumbs?: SellerDirectoryListingThumb[]
  tileMeta: SellerDirectoryTileMeta
  avgRating: number
  reviewCount: number
  inventoryCount: number
  avatarSrc?: string
  mosaicSlots?: SellerDirectoryMosaicSlot[]
}

type SellersDirectoryGridProps = {
  items: SellerDirectoryGridItem[]
}

export function SellersDirectoryGrid({ items }: SellersDirectoryGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item, index) => (
        <li key={item.shop.id} className="min-w-0 h-full">
          <SellerDirectoryCard
            shop={item.shop}
            thumbs={item.thumbs}
            tileMeta={item.tileMeta}
            avgRating={item.avgRating}
            reviewCount={item.reviewCount}
            inventoryCount={item.inventoryCount}
            avatarSrc={item.avatarSrc}
            mosaicSlots={item.mosaicSlots}
            imagePriority={index < 4}
          />
        </li>
      ))}
    </ul>
  )
}

import {
  SellerDirectoryCard,
  type SellerDirectoryCardShop,
  type SellerDirectoryListingThumb,
} from "@/components/sellers/seller-directory-card"
import type { SellerDirectoryMosaicSlot } from "@/lib/sellers/directory-mosaic-images"
import type { SellerDirectoryTileMeta } from "@/lib/sellers/directory-tile-meta"

export type SellerDirectoryGridItem = {
  shop: SellerDirectoryCardShop
  thumbs: SellerDirectoryListingThumb[]
  tileMeta: SellerDirectoryTileMeta
  avgRating: number
  reviewCount: number
  avatarSrc?: string
  mosaicSlots?: SellerDirectoryMosaicSlot[]
  initialFollowing: boolean
  isOwnProfile: boolean
}

type SellersDirectoryGridProps = {
  items: SellerDirectoryGridItem[]
  isLoggedIn: boolean
}

export function SellersDirectoryGrid({ items, isLoggedIn }: SellersDirectoryGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item, index) => (
        <li key={item.shop.id} className="min-w-0 h-full">
          <SellerDirectoryCard
            shop={item.shop}
            thumbs={item.thumbs}
            tileMeta={item.tileMeta}
            avgRating={item.avgRating}
            reviewCount={item.reviewCount}
            avatarSrc={item.avatarSrc}
            mosaicSlots={item.mosaicSlots}
            initialFollowing={item.initialFollowing}
            isLoggedIn={isLoggedIn}
            isOwnProfile={item.isOwnProfile}
            imagePriority={index < 5}
          />
        </li>
      ))}
    </ul>
  )
}

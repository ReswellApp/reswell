import { ShopNewListingStandardTile } from "@/components/features/marketplace/shop-new-listing-standard-tile"

export interface MarketplaceNewItem {
  id: string
  title: string
  price: number
  image_url: string | null
  stock_quantity: number
  /** Marketplace category name (from `listings.categories`) when available. */
  categoryLabel?: string | null
}

export function MarketplaceNewGrid({ items }: { items: MarketplaceNewItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <ShopNewListingStandardTile
          key={item.id}
          layout="grid"
          showFavorites={false}
          listing={{
            id: item.id,
            slug: null,
            title: item.title,
            price: Number(item.price),
            listing_images: item.image_url
              ? [{ url: item.image_url, is_primary: true }]
              : null,
          }}
          stockQuantity={item.stock_quantity}
          userId={null}
          isFavorited={false}
          categoryName={item.categoryLabel ?? null}
        />
      ))}
    </div>
  )
}

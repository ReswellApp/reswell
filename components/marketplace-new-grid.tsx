import { ListingTile } from "@/components/listing-tile"
import { listingProductCardClassName } from "@/lib/listing-card-styles"

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
        <ListingTile
          key={item.id}
          href={`/shop/${item.id}`}
          listingId={item.id}
          title={item.title}
          imageAlt={item.title}
          imageUrl={item.image_url}
          price={Number(item.price)}
          imageAspect="square"
          imageFit="contain"
          useBlurPlaceholder={false}
          cardClassName={listingProductCardClassName}
          cardContentClassName="p-3"
          titleClassName="text-sm font-medium line-clamp-1 hover:text-primary transition-colors text-foreground"
          categoryPill={item.categoryLabel}
          showFavorites={false}
        />
      ))}
    </div>
  )
}

import { SurfShopCard } from "@/components/features/surf-shops/surf-shop-card"
import type { CitySurfShop } from "@/lib/city-landing-surf-shops"

export function SurfShopsDirectory({ shops }: { shops: CitySurfShop[] }) {
  if (shops.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No surf shops listed yet. Check back soon.</p>
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
      {shops.map((shop, index) => (
        <li key={shop.id} className="min-w-0">
          <SurfShopCard shop={shop} layout="grid" imagePriority={index === 0} />
        </li>
      ))}
    </ul>
  )
}

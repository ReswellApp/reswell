import { HomeListingScrollRow } from "@/components/features/home/home-listing-scroll-row"
import { SurfShopCard } from "@/components/features/surf-shops/surf-shop-card"
import type { CitySurfShop } from "@/lib/city-landing-surf-shops"
import { cityTopListingTileWrapClass } from "@/lib/home-listing-scroll-styles"

export function CitySurfShopsRow({
  cityName,
  shops,
}: {
  cityName: string
  shops: CitySurfShop[]
}) {
  if (shops.length === 0) return null

  return (
    <section className="mt-8 mb-8 sm:mt-10 sm:mb-10" aria-label={`Surf shops in ${cityName}`}>
      <h2 className="mb-4 text-xl font-bold tracking-tight text-foreground sm:mb-5 sm:text-2xl">
        Surf shops in {cityName}
      </h2>
      <HomeListingScrollRow
        uniformCardHeights
        tileWrapClassName={cityTopListingTileWrapClass}
        rowGapClassName="gap-1.5 sm:gap-2"
      >
        {shops.map((shop, index) => (
          <SurfShopCard key={shop.id} shop={shop} imagePriority={index === 0} />
        ))}
      </HomeListingScrollRow>
    </section>
  )
}

import { CityLandingStripSection } from "@/components/features/cities/city-landing-strip-section"
import { HomeListingScrollRow } from "@/components/features/home/home-listing-scroll-row"
import { SurfShopCard } from "@/components/features/surf-shops/surf-shop-card"
import type { CitySurfShop } from "@/lib/city-landing-surf-shops"
import { cityEntityTileWrapClass } from "@/lib/home-listing-scroll-styles"

export function CitySurfShopsRow({
  cityName,
  shops,
  showDivider = false,
}: {
  cityName: string
  shops: CitySurfShop[]
  showDivider?: boolean
}) {
  if (shops.length === 0) return null

  return (
    <CityLandingStripSection
      label={`Surf shops in ${cityName}`}
      title={`Surf shops in ${cityName}`}
      showDivider={showDivider}
    >
      <HomeListingScrollRow
        inset
        uniformCardHeights
        tileWrapClassName={cityEntityTileWrapClass}
        rowGapClassName="gap-2 sm:gap-2.5"
      >
        {shops.map((shop, index) => (
          <SurfShopCard key={shop.id} shop={shop} imagePriority={index === 0} density="compact" />
        ))}
      </HomeListingScrollRow>
    </CityLandingStripSection>
  )
}

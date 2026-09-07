import { CityLandingStripSection } from "@/components/features/cities/city-landing-strip-section"
import { CityTopSellerCard } from "@/components/features/cities/city-top-seller-card"
import { HomeListingScrollRow } from "@/components/features/home/home-listing-scroll-row"
import { cityEntityTileWrapClass } from "@/lib/home-listing-scroll-styles"
import type { CityTopSeller } from "@/lib/types/city-top-sellers"

export function CityTopSellersRow({
  cityName,
  sellers,
  showDivider = false,
}: {
  cityName: string
  sellers: CityTopSeller[]
  showDivider?: boolean
}) {
  if (sellers.length === 0) return null

  return (
    <CityLandingStripSection
      label={`Top sellers in ${cityName}`}
      title={`Top sellers in ${cityName}`}
      showDivider={showDivider}
    >
      <HomeListingScrollRow
        inset
        uniformCardHeights
        tileWrapClassName={cityEntityTileWrapClass}
        rowGapClassName="gap-2 sm:gap-2.5"
      >
        {sellers.map((seller, index) => (
          <CityTopSellerCard key={seller.id} seller={seller} imagePriority={index === 0} />
        ))}
      </HomeListingScrollRow>
    </CityLandingStripSection>
  )
}

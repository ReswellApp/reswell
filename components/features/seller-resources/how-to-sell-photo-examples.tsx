import { HomeListingScrollRow } from "@/components/features/home/home-listing-scroll-row"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { ListingTile } from "@/components/listing-tile"
import {
  homeListingScrollImageSizes,
  homePeerListingTileTitleClass,
  homeUniformScrollBodyClass,
  homeUniformScrollCardClass,
  homeUniformScrollLinkClass,
  homeUniformScrollTitleSlotClass,
} from "@/lib/home-listing-scroll-styles"
import { capitalizeWords } from "@/lib/listing-labels"
import type { HowToSellPhotoExample } from "@/lib/types/seller-resources-how-to-sell"

export function HowToSellPhotoExamples({ examples }: { examples: HowToSellPhotoExample[] }) {
  if (examples.length === 0) return null

  return (
    <HowToSellSection
      id="photos"
      wash
      eyebrow="Photo examples"
      title="Shoot photos like a pro"
      lead="Swipe real Reswell listings with strong lighting and angles. Use them as a reference — not as photos to copy onto your listing."
    >
      <HomeListingScrollRow uniformCardHeights>
        {examples.map((example, index) => (
          <ListingTile
            key={example.listingId}
            href={example.href}
            listingId={example.listingId}
            title={example.title}
            price={0}
            imageAlt={capitalizeWords(example.title)}
            listingImages={example.listingImages}
            imageSizes={homeListingScrollImageSizes}
            imagePriority={index === 0}
            linkLayout="unified"
            linkClassName={homeUniformScrollLinkClass}
            cardClassName={homeUniformScrollCardClass}
            cardContentClassName={homeUniformScrollBodyClass}
            showFavorites={false}
          >
            <div className={homeUniformScrollTitleSlotClass}>
              <h3 className={homePeerListingTileTitleClass}>{capitalizeWords(example.title)}</h3>
            </div>
          </ListingTile>
        ))}
      </HomeListingScrollRow>
    </HowToSellSection>
  )
}

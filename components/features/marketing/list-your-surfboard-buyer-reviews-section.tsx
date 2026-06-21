import { FadeInSection } from "@/components/fade-in-section"
import { ListYourSurfboardSellCta } from "@/components/features/marketing/list-your-surfboard-sell-cta"
import { ListYourSurfboardReviewsMarquee } from "@/components/features/marketing/list-your-surfboard-reviews-marquee"
import { ListYourSurfboardMobileFold } from "@/components/features/marketing/list-your-surfboard-mobile-fold"
import {
  MarketingHeadlineHero,
  marketingHeadlineTitleClass,
} from "@/components/features/marketing/marketing-headline-hero"
import { MadeWithLoveSantaBarbara } from "@/components/made-with-love-santa-barbara"
import type { MarketplaceShowcaseReviewRow } from "@/lib/db/marketplace-reviews-showcase"

type ListYourSurfboardMarketplaceReviewsSectionProps = {
  reviews: MarketplaceShowcaseReviewRow[]
  heroListingImages: readonly string[]
  className?: string
}

export function ListYourSurfboardMarketplaceReviewsSection({
  reviews,
  heroListingImages,
  className,
}: ListYourSurfboardMarketplaceReviewsSectionProps) {
  return (
    <FadeInSection className={className}>
      <ListYourSurfboardMobileFold>
        <ListYourSurfboardReviewsMarquee reviews={reviews} mobileOneScreen />

        <MarketingHeadlineHero
          bordered={false}
          className="bg-background"
          compactTop
          mobileOneScreen
          plainSurface
          heroListingImages={heroListingImages}
          listingImagesOnly
          headline={
            <>
              <h2 className={marketingHeadlineTitleClass} data-lys-headline>
                Our mission is to make buying and selling surfboards{" "}
                <span className="text-listingHeart">simple</span>, trusted, and{" "}
                <span className="text-listingHeart">genuinely enjoyable</span>.
              </h2>
              <MadeWithLoveSantaBarbara
                variant="light"
                className="mt-4 justify-start max-lg:mt-0 max-lg:justify-start"
                data-lys-made-with-love
              />
            </>
          }
        />

        <section
          data-lys-fold-cta
          className="shrink-0 border-t border-border/60 bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-0 max-lg:block lg:hidden"
        >
          <ListYourSurfboardSellCta size="lg" className="w-full">
            List your surfboard
          </ListYourSurfboardSellCta>
        </section>

        <section className="hidden pt-0 lg:block lg:pb-12 lg:pt-2">
          <div className="container mx-auto flex justify-end px-4 sm:px-6">
            <ListYourSurfboardSellCta size="lg" className="w-full sm:w-auto">
              List your surfboard
            </ListYourSurfboardSellCta>
          </div>
        </section>
      </ListYourSurfboardMobileFold>
    </FadeInSection>
  )
}

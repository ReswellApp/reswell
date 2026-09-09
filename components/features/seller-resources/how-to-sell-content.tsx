import { HowToSellBoxGuide } from "@/components/features/seller-resources/how-to-sell-box-guide"
import { HowToSellHero } from "@/components/features/seller-resources/how-to-sell-hero"
import { HowToSellListingWalkthrough } from "@/components/features/seller-resources/how-to-sell-listing-walkthrough"
import { HowToSellPhotoExamples } from "@/components/features/seller-resources/how-to-sell-photo-examples"
import { HowToSellShopSpotlights } from "@/components/features/seller-resources/how-to-sell-shop-spotlights"
import { HowToSellValueStrip } from "@/components/features/seller-resources/how-to-sell-value-strip"
import { SellerResourcesCta } from "@/components/features/seller-resources/seller-resources-cta"
import type { HowToSellGuidePayload } from "@/lib/types/seller-resources-how-to-sell"

export function HowToSellContent({
  guide,
}: {
  guide: HowToSellGuidePayload
}) {
  return (
    <main className="flex-1 bg-white">
      <HowToSellHero examples={guide.photoExamples} />
      <HowToSellValueStrip />
      <HowToSellListingWalkthrough />
      <HowToSellPhotoExamples examples={guide.photoExamples} />
      <HowToSellBoxGuide />
      <HowToSellShopSpotlights shops={guide.shops} />
      <SellerResourcesCta />
    </main>
  )
}

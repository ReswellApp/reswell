import Link from "next/link"
import { Truck } from "lucide-react"
import { ModelPageHeroPhoto } from "@/components/features/models/model-page-hero-photo"
import { ModelPageStars } from "@/components/features/models/model-page-stars"
import { ModelSaveModelButton } from "@/components/features/models/model-page-viewer"
import { ListingPriceWithMarkdown } from "@/components/features/listings/listing-price-with-markdown"
import { LIST_YOUR_SURFBOARD_SELL_HREF } from "@/components/features/marketing/list-your-surfboard-sell-cta"
import { Button } from "@/components/ui/button"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { brandProductCategoryLabel } from "@/lib/brand-product-categories"
import { listingHeroSlideSrc } from "@/lib/listing-image-display"
import { listingDetailHref, peerListingCheckoutHref } from "@/lib/listing-href"
import { formatBoardType, formatCondition } from "@/lib/listing-labels"
import { modelPageHeroImage, pickModelPageListingWithImage } from "@/lib/models/listing-image"
import { modelPricingHref } from "@/lib/pricing/model-pricing"
import {
  lowestListingPrice,
  modelPageHeroOffer,
  modelUsedRangeLabel,
} from "@/lib/models/model-page-hero"
import type { ModelPageData } from "@/lib/services/modelPage"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import { cn } from "@/lib/utils"

const DETAILS_ANCHOR_CLASS = "scroll-mt-[calc(var(--site-header-height,4rem)+3.25rem)]"

export function ModelPageHeader({
  page,
  criteria,
  anchorDetails,
}: {
  page: ModelPageData
  criteria: BoardSavedSearchCriteria
  /** Land `#details` here when the page has no separate details section. */
  anchorDetails: boolean
}) {
  const { brand, model, priceGuide, reviewStats, listings } = page
  const single = listings.length === 1 ? listings[0] : null
  const usedRange = modelUsedRangeLabel(priceGuide?.typical.low_usd, priceGuide?.typical.high_usd)
  const offer = modelPageHeroOffer({
    listingCount: listings.length,
    lowestPriceUsd: lowestListingPrice(listings.map((listing) => Number(listing.price))),
    lengthLabel: single?.board_length?.trim() || null,
    conditionLabel: single ? formatCondition(single.condition) || null : null,
    usedRange,
  })
  const boardType = formatBoardType(model.board_category_slug)
  const madeIn = brand.location_label?.trim() || null
  const meta = [brandProductCategoryLabel(model.product_category_slug), boardType, madeIn]
    .filter(Boolean)
    .join(" · ")

  const livePhoto = pickModelPageListingWithImage(listings, page.topPick)
  const soldPhoto = pickModelPageListingWithImage(page.soldListings)
  const heroImage = modelPageHeroImage({
    livePhotoUrl: livePhoto ? listingHeroSlideSrc(livePhoto.listing_images) : null,
    soldPhotoUrl: soldPhoto ? listingHeroSlideSrc(soldPhoto.listing_images) : null,
    fallbackSoldUrl: page.listingImageUrl,
  })
  const showingLivePhoto = heroImage.source === "live"
  const photoListing = showingLivePhoto ? livePhoto : heroImage.source === "sold" ? soldPhoto : null
  const caption = heroImage.source === "sold" ? "Photo from a past sale" : null
  const singlePrice = single ? Number(single.price) : Number.NaN

  return (
    <header
      id={anchorDetails ? "details" : undefined}
      className={cn(
        "grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-12 xl:gap-16",
        anchorDetails && DETAILS_ANCHOR_CLASS,
      )}
    >
      <ModelPageHeroPhoto
        imageUrl={heroImage.url}
        alt={`${brand.name} ${model.name}`}
        href={photoListing ? listingDetailHref(photoListing) : null}
        listingId={showingLivePhoto && livePhoto ? livePhoto.id : null}
        caption={caption}
        brandName={brand.name}
        brandLogoUrl={brand.logo_url}
      />

      <div className="min-w-0 lg:pt-1">
        <Link
          href={`${BRANDS_BASE}/${brand.slug}`}
          className="text-[15px] font-semibold text-foreground underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground"
        >
          {brand.name}
        </Link>
        <h1 className="mt-1 text-balance text-[2rem] font-bold leading-snug tracking-[-0.025em] text-foreground xl:text-[2.125rem]">
          {model.name}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-muted-foreground">
          {meta ? <span>{meta}</span> : null}
          {reviewStats.reviewCount > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <ModelPageStars rating={reviewStats.avgRating} />
              <span className="tabular-nums">
                {reviewStats.avgRating.toFixed(1)} ({reviewStats.reviewCount})
              </span>
            </span>
          ) : null}
        </p>

        <div className="mt-5">
          {offer.kind === "listing" && single && Number.isFinite(singlePrice) ? (
            <ListingPriceWithMarkdown
              priceUsd={singlePrice}
              compareAtPriceUsd={single.compare_at_price}
              priceClassName="text-4xl font-bold tracking-tight text-foreground xl:text-[2.625rem] xl:leading-none"
            />
          ) : offer.kind === "from" || offer.kind === "range" ? (
            <p className="text-4xl font-bold tabular-nums tracking-tight text-foreground xl:text-[2.625rem] xl:leading-none">
              {offer.headline}
            </p>
          ) : null}
          <p className={cn("text-sm text-muted-foreground", offer.kind === "unavailable" ? "mt-0" : "mt-1.5")}>
            {offer.supporting}
          </p>
          {single?.shipping_available ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Truck className="h-4 w-4" aria-hidden />
              Shipping available
            </p>
          ) : single?.local_pickup ? (
            <p className="mt-3 text-sm text-muted-foreground">Local pickup</p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {single ? (
            <Button asChild className="rounded-full">
              <Link href={peerListingCheckoutHref(single.section, single.slug ?? single.id)}>Buy now</Link>
            </Button>
          ) : null}
          <ModelSaveModelButton
            criteria={criteria}
            label="Save this model"
            savedLabel="Model saved"
            savedSearchLabel={`${brand.name} ${model.name}`}
            successTitle="Model saved"
            successDescription={`We'll email you when a ${brand.name} ${model.name} is listed on Reswell.`}
          />
          <Button asChild variant="outline" className="rounded-full">
            <Link href={LIST_YOUR_SURFBOARD_SELL_HREF}>Sell yours</Link>
          </Button>
        </div>
        <p className="mt-3 flex flex-wrap gap-x-4 text-sm font-medium">
          {single ? (
            <Link
              href={listingDetailHref(single)}
              className="text-foreground underline-offset-4 hover:underline"
            >
              View listing
            </Link>
          ) : null}
          <Link
            href={modelPricingHref(brand.slug, page.modelSlug)}
            className="text-foreground underline-offset-4 hover:underline"
          >
            Pricing
          </Link>
        </p>
      </div>
    </header>
  )
}

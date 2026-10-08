import { ListingSellerReviewsAccordion } from "@/components/features/listings/listing-about-seller-section"
import {
  ListingDetailEngagementMetrics,
  type ListingOfferToCartProps,
} from "@/components/listing-detail-engagement-metrics"
import { ReswellPlatformRatingWidget } from "@/components/features/reswell/reswell-platform-rating-widget"
import { loadSurfboardListingSocialProof } from "@/lib/services/surfboardListingPdpExtras"

type SocialProofKey = {
  sellerId: string
  listingId: string
  isSold: boolean
}

export async function SurfboardListingEngagementMetrics({
  sellerId,
  listingId,
  isSold,
  views,
  className,
  offerToCart = null,
}: SocialProofKey & {
  views: number
  className?: string
  offerToCart?: ListingOfferToCartProps | null
}) {
  const social = await loadSurfboardListingSocialProof(sellerId, listingId, isSold)
  return (
    <ListingDetailEngagementMetrics
      views={views}
      watchers={social.listingWatchersCount}
      cartHolderCount={social.cartHolderCount}
      isSold={isSold}
      offerToCart={offerToCart}
      className={className}
    />
  )
}

export async function SurfboardListingCartScarcityNote({
  sellerId,
  listingId,
}: {
  sellerId: string
  listingId: string
}) {
  const social = await loadSurfboardListingSocialProof(sellerId, listingId, false)
  if (social.cartHolderCount <= 0) return null
  const text =
    social.cartHolderCount === 1
      ? "1 other person has this in their cart"
      : `${social.cartHolderCount} other people have this in their cart`
  return <span className="text-muted-foreground"> {text}</span>
}

export async function SurfboardListingSellerReviews({
  sellerId,
  listingId,
  isSold,
  itemsSold,
  sellerProfileHref,
}: SocialProofKey & {
  itemsSold: number
  sellerProfileHref: string
}) {
  const social = await loadSurfboardListingSocialProof(sellerId, listingId, isSold)
  return (
    <ListingSellerReviewsAccordion
      avgRating={social.sellerAvgRating}
      reviewCount={social.sellerReviewCount}
      previewReviews={social.sellerReviewPreviews}
      itemsSold={itemsSold}
      sellerProfileHref={sellerProfileHref}
    />
  )
}

export async function SurfboardListingPlatformRating({
  sellerId,
  listingId,
  isSold,
  className,
}: SocialProofKey & { className?: string }) {
  const social = await loadSurfboardListingSocialProof(sellerId, listingId, isSold)
  return <ReswellPlatformRatingWidget summary={social.platformReviewSummary} className={className} />
}

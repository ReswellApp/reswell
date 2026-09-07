"use client"

import { useState } from "react"
import { MapPin, Star, Truck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  SellerProfileHero,
  type SellerProfileHeroShop,
  type SellerProfileTab,
} from "@/components/sellers/seller-profile-hero"
import {
  SellerProfileListingsPanel,
  type SellerProfileListing,
} from "@/components/sellers/seller-profile-listings-panel"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { ratingStarFilledClassName } from "@/lib/rating-star-styles"
import type { SellerDirectoryTileMeta } from "@/lib/sellers/directory-tile-meta"
import { sellerProfileShellClassName } from "@/lib/sellers/seller-profile-layout"
import { MarketplaceReviewPhotos } from "@/components/features/reviews/marketplace-review-photos"
import type { MarketplaceReviewPhotoRef } from "@/lib/types/marketplace-review"
import { cn } from "@/lib/utils"

type SellerProfileReview = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewerLabel: string
  photos: MarketplaceReviewPhotoRef[]
}

type SellerProfileViewProps = {
  shop: SellerProfileHeroShop
  displayName: string | null | undefined
  isShop: boolean | null | undefined
  avgRating: number
  reviewCount: number
  currentListingCount: number
  followerCount: number
  followingCount: number | null
  soldCount: number
  isFollowing: boolean
  isOwnProfile: boolean
  isLoggedIn: boolean
  currentListings: SellerProfileListing[]
  pastListings: SellerProfileListing[]
  favoritedIds: string[]
  viewerId: string | null
  tileMeta: SellerDirectoryTileMeta
  reviewsAsSeller: SellerProfileReview[]
  reviewsAsBuyer: SellerProfileReview[]
}

function ReviewsSection({
  heading,
  emptyFallback,
  reviews,
}: {
  heading: string
  emptyFallback: string
  reviews: SellerProfileReview[]
}) {
  return (
    <div>
      <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        <Star className={cn("h-5 w-5", ratingStarFilledClassName)} strokeWidth={0} aria-hidden />
        {heading}
      </h2>
      {reviews.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {reviews.map((review) => (
            <Card key={review.id} className="border-border/80 shadow-soft">
              <CardContent className="px-4 py-4">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">{review.reviewerLabel}</span>
                  <span className="text-muted-foreground">·</span>
                  <span
                    className="inline-flex items-center"
                    role="img"
                    aria-label={`${review.rating} out of 5 stars`}
                  >
                    <SellerRatingStarRow value={review.rating} size="md" />
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {review.created_at
                      ? new Date(review.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : null}
                  </span>
                </div>
                {review.comment?.trim() ? (
                  <p className="text-sm text-muted-foreground">{review.comment}</p>
                ) : null}
                <MarketplaceReviewPhotos reviewId={review.id} photos={review.photos} size="md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyFallback}</p>
      )}
    </div>
  )
}

export function SellerProfileView({
  shop,
  displayName,
  isShop,
  avgRating,
  reviewCount,
  currentListingCount,
  followerCount,
  followingCount,
  soldCount,
  isFollowing,
  isOwnProfile,
  isLoggedIn,
  currentListings,
  pastListings,
  favoritedIds,
  viewerId,
  tileMeta,
  reviewsAsSeller,
  reviewsAsBuyer,
}: SellerProfileViewProps) {
  const [activeTab, setActiveTab] = useState<SellerProfileTab>("listings")
  const hasActiveListings = currentListings.length > 0
  const hasPastListings = pastListings.length > 0
  const listingsTabListings = hasActiveListings
    ? currentListings
    : hasPastListings
      ? pastListings
      : []
  const showNoActiveNotice = !hasActiveListings && hasPastListings

  return (
    <main className="flex-1 min-w-0 overflow-x-hidden">
      <SellerProfileHero
        shop={shop}
        displayName={displayName}
        isShop={isShop}
        avgRating={avgRating}
        reviewCount={reviewCount}
        currentListingCount={currentListingCount}
        followerCount={followerCount}
        followingCount={followingCount}
        isFollowing={isFollowing}
        isOwnProfile={isOwnProfile}
        isLoggedIn={isLoggedIn}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        soldCount={soldCount}
        listingImageFallbacks={[...currentListings, ...pastListings]}
      />

      <div className={cn(sellerProfileShellClassName, "pb-10 pt-5 sm:pb-14 sm:pt-6 lg:pb-16")}>
        {activeTab === "listings" ? (
          <SellerProfileListingsPanel
            listings={listingsTabListings}
            favoritedIds={favoritedIds}
            viewerId={viewerId}
            tileMeta={tileMeta}
            noActiveListingsNotice={showNoActiveNotice}
            onViewSoldTab={() => setActiveTab("sold")}
            emptyMessage={
              hasPastListings
                ? "No sold listings match your filters."
                : "No listings in this category yet."
            }
          />
        ) : null}

        {activeTab === "feedback" ? (
          <div className="space-y-10">
            {reviewCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span
                  className="inline-flex items-center"
                  role="img"
                  aria-label={`Average ${avgRating.toFixed(1)} out of 5 stars`}
                >
                  <SellerRatingStarRow value={avgRating} size="md" />
                </span>
                <span className="font-semibold text-foreground">{avgRating.toFixed(1)}</span>
                <span>
                  · {reviewCount.toLocaleString()} review{reviewCount !== 1 ? "s" : ""}
                </span>
              </div>
            ) : null}

            <ReviewsSection
              heading="Reviews as a seller"
              emptyFallback={reviewCount === 0 ? "No reviews yet." : "No seller reviews yet."}
              reviews={reviewsAsSeller}
            />

            {reviewsAsBuyer.length > 0 ? (
              <ReviewsSection
                heading="Reviews as a buyer"
                emptyFallback="No buyer reviews yet."
                reviews={reviewsAsBuyer}
              />
            ) : null}
          </div>
        ) : null}

        {activeTab === "info" ? (
          <div className="space-y-10">
            <section className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">About this seller</h2>
              {!(shop.shop_description || shop.bio) ? (
                <p className="text-sm text-muted-foreground">This seller has not added a shop description yet.</p>
              ) : null}
              {(shop.city || shop.shop_address) && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{shop.shop_address || shop.city}</span>
                </p>
              )}
              {tileMeta.offersShipping ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Truck className="h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    {tileMeta.shipFromState
                      ? `Ships from ${tileMeta.shipFromState}. Seller offers shipping on select listings.`
                      : "Seller offers shipping on select listings."}
                  </span>
                </p>
              ) : tileMeta.locatedInLabel ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{tileMeta.locatedInLabel}. Local pickup may be available.</span>
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Member since{" "}
                {new Date(shop.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">Policies</h2>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Purchases on Reswell are covered by buyer protection. Shipping, returns, and pickup details are set
                per listing — check each item before you buy. Message the seller with any questions before checkout.
              </p>
            </section>
          </div>
        ) : null}

        {activeTab === "sold" ? (
          <SellerProfileListingsPanel
            listings={pastListings}
            favoritedIds={favoritedIds}
            viewerId={viewerId}
            tileMeta={tileMeta}
            showPromoCards={false}
            emptyMessage="No sold or previous listings yet."
          />
        ) : null}
      </div>
    </main>
  )
}

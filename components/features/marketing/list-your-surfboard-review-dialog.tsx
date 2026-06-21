"use client"

import Image from "next/image"
import Link from "next/link"
import { X } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MessageProfileAvatar } from "@/components/features/messages/message-profile-avatar"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { Badge } from "@/components/ui/badge"
import type {
  MarketplaceShowcaseReviewRole,
  MarketplaceShowcaseReviewRow,
} from "@/lib/db/marketplace-reviews-showcase"
import { portraitShimmer } from "@/lib/image-shimmer"

const ROLE_LABEL: Record<MarketplaceShowcaseReviewRole, string> = {
  buyer: "Buyer",
  seller: "Seller",
}

type ListYourSurfboardReviewDialogProps = {
  review: MarketplaceShowcaseReviewRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ListYourSurfboardReviewDialog({
  review,
  open,
  onOpenChange,
}: ListYourSurfboardReviewDialogProps) {
  const listingImageAlt = review?.listingTitle?.trim() || "Reviewed surfboard listing"
  const reviewDate =
    review != null
      ? new Date(review.created_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : ""

  return (
    <Dialog open={open && review != null} onOpenChange={onOpenChange}>
      {review ? (
        <DialogContent
          className="w-[calc(100%-2rem)] max-w-md gap-0 overflow-hidden rounded-lg p-0 sm:w-full sm:max-w-lg"
          showCloseButton={false}
        >
          <DialogClose className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200/80 bg-white text-foreground shadow-md transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" strokeWidth={2.25} />
            <span className="sr-only">Close</span>
          </DialogClose>

          {review.listingImageSrc ? (
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
              <Image
                src={review.listingImageSrc}
                alt={listingImageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 640px) calc(100vw - 2rem), 512px"
                placeholder="blur"
                blurDataURL={portraitShimmer}
              />
            </div>
          ) : null}

        <div className="space-y-4 p-6">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-start gap-3">
              <MessageProfileAvatar
                avatarUrl={review.reviewerAvatarUrl}
                displayName={review.reviewerLabel}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div aria-label={`${review.rating} out of 5 stars`}>
                    <SellerRatingStarRow value={review.rating} size="md" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                    {ROLE_LABEL[review.role]}
                  </Badge>
                </div>
                <div className="mt-2">
                  {review.reviewerProfileHref ? (
                    <DialogTitle className="text-lg font-semibold leading-tight">
                      <Link
                        href={review.reviewerProfileHref}
                        className="hover:text-listingHeart hover:underline"
                      >
                        {review.reviewerLabel}
                      </Link>
                    </DialogTitle>
                  ) : (
                    <DialogTitle className="text-lg font-semibold leading-tight">
                      {review.reviewerLabel}
                    </DialogTitle>
                  )}
                  <DialogDescription className="mt-1 text-sm">{reviewDate}</DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {review.listingTitle ? (
            <p className="text-sm font-medium text-muted-foreground">{review.listingTitle}</p>
          ) : null}

          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {review.comment}
          </p>
        </div>
      </DialogContent>
      ) : null}
    </Dialog>
  )
}

"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronDown, ExternalLink, Star } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { VerifiedBadge } from "@/components/verified-badge"
import { sellerProfileHref } from "@/lib/seller-slug"
import { cn } from "@/lib/utils"
import type {
  OtherPartyProfileSummary,
  ProfileReviewItem,
} from "@/lib/messages/profile-reviews-loader"

interface ConversationPartyProfileProps {
  /** Display name of the other party (used as link text + popover header). */
  displayName: string
  /** Avatar URL — falls back to initial. */
  avatarUrl: string | null
  /** Verified seller badge flag. */
  shopVerified: boolean
  /** Review/listing snapshot. `null` while still loading. */
  profile: OtherPartyProfileSummary | null
  /** Optional sub-line under the name (e.g. listing title link). */
  secondaryLine?: React.ReactNode
}

/**
 * Header block for the other conversation party in a thread.
 *
 * - Avatar + name link to `/sellers/[slug]` only when the user has listings.
 *   For pure buyers (no listings yet) the name renders as static text — they
 *   don't have a public seller page.
 * - When the user has any received reviews, an inline star + count chip opens
 *   a popover with the review feed (each entry tagged "as seller" / "as buyer").
 */
export function ConversationPartyProfile({
  displayName,
  avatarUrl,
  shopVerified,
  profile,
  secondaryLine,
}: ConversationPartyProfileProps) {
  const linkToSellerPage = !!profile?.hasListings && !!profile?.sellerSlug
  const reviewsCount = profile?.summary.count ?? 0
  const showRatingChip = reviewsCount > 0
  const sellerHref = useMemo(
    () => sellerProfileHref({ seller_slug: profile?.sellerSlug ?? null }),
    [profile?.sellerSlug],
  )

  const Avatar = (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border/60">
      {avatarUrl ? (
        <Image
          src={avatarUrl || "/placeholder.svg"}
          alt={displayName}
          fill
          className="object-cover"
          sizes="44px"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[15px] font-semibold text-foreground">
          {displayName?.[0]?.toUpperCase() || "?"}
        </div>
      )}
    </div>
  )

  const NameRow = (
    <div className="flex min-w-0 items-center gap-1.5">
      <p
        className={cn(
          "truncate text-[17px] font-semibold leading-tight text-foreground",
          linkToSellerPage && "group-hover:underline",
        )}
      >
        {displayName}
      </p>
      {shopVerified && (
        <span className="shrink-0">
          <VerifiedBadge size="sm" />
        </span>
      )}
    </div>
  )

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
      {linkToSellerPage ? (
        <Link
          href={sellerHref}
          prefetch={false}
          className="group flex shrink-0 items-center"
          aria-label={`Open ${displayName}'s seller profile`}
        >
          {Avatar}
        </Link>
      ) : (
        Avatar
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {linkToSellerPage ? (
          <Link
            href={sellerHref}
            prefetch={false}
            className="group min-w-0"
            aria-label={`Open ${displayName}'s seller profile`}
          >
            {NameRow}
          </Link>
        ) : (
          NameRow
        )}
        {secondaryLine ? <div className="mt-0.5 min-w-0">{secondaryLine}</div> : null}
      </div>

      {showRatingChip ? (
        <ReviewsPopover
          displayName={displayName}
          profile={profile!}
          sellerHref={linkToSellerPage ? sellerHref : null}
        />
      ) : null}
    </div>
  )
}

interface ReviewsPopoverProps {
  displayName: string
  profile: OtherPartyProfileSummary
  /** When set, popover footer offers a deep link to the seller profile. */
  sellerHref: string | null
}

function ReviewsPopover({ displayName, profile, sellerHref }: ReviewsPopoverProps) {
  const [open, setOpen] = useState(false)
  const { summary, recentReviews } = profile
  const ratingLabel = summary.avg.toFixed(1)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Show reviews for ${displayName} (average ${ratingLabel} from ${summary.count})`}
          aria-expanded={open}
          className="group/chip inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-2.5 py-1 text-[13px] font-medium leading-none text-foreground shadow-[0_1px_1px_rgba(17,17,17,0.04)] transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <SellerRatingStarRow value={summary.avg} size="sm" />
          <span className="tabular-nums">{ratingLabel}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {summary.count}
            <span className="ml-0.5 hidden sm:inline">
              {summary.count === 1 ? " review" : " reviews"}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(92vw,22rem)] p-0"
      >
        <div className="border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[15px] font-semibold leading-tight text-foreground">
              {displayName}'s reviews
            </p>
            <span
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              aria-hidden
            >
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              <span className="tabular-nums font-medium text-foreground">
                {ratingLabel}
              </span>
              <span>·</span>
              <span>
                {summary.count} {summary.count === 1 ? "review" : "reviews"}
              </span>
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.asSellerCount > 0 && summary.asBuyerCount > 0
              ? `${summary.asSellerCount} as seller · ${summary.asBuyerCount} as buyer`
              : summary.asSellerCount > 0
                ? `${summary.asSellerCount} as seller`
                : `${summary.asBuyerCount} as buyer`}
          </p>
        </div>
        <div className="max-h-[min(60vh,22rem)] overflow-y-auto px-2 py-2">
          {recentReviews.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No reviews yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {recentReviews.map((review) => (
                <li key={review.id}>
                  <ReviewRow review={review} />
                </li>
              ))}
            </ul>
          )}
        </div>
        {sellerHref ? (
          <div className="border-t border-border/60 px-3 py-2">
            <Link
              href={sellerHref}
              prefetch={false}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:underline"
              onClick={() => setOpen(false)}
            >
              View full profile
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function ReviewRow({ review }: { review: ProfileReviewItem }) {
  const reviewerLabel = review.reviewer?.display_name?.trim() || "Verified user"
  const directionLabel =
    review.direction === "as_seller" ? "as seller" : "as buyer"
  const date = new Date(review.created_at)
  return (
    <div className="rounded-md px-2 py-2 hover:bg-muted/40">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium text-foreground">{reviewerLabel}</span>
        <span className="text-muted-foreground">·</span>
        <SellerRatingStarRow value={review.rating} size="sm" />
        <span className="ml-auto text-muted-foreground">
          {date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {directionLabel}
      </div>
      {review.comment?.trim() ? (
        <p className="mt-1.5 text-sm leading-snug text-foreground/90">
          {review.comment}
        </p>
      ) : null}
    </div>
  )
}

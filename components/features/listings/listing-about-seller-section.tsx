import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { VerifiedBadge } from "@/components/verified-badge"
import { MessageSellerDialog } from "@/components/features/messages/message-seller-dialog"
import {
  MessageSquare,
  Star,
} from "lucide-react"
import { ratingStarEmptyClassName, ratingStarFilledClassName } from "@/lib/rating-star-styles"
import { cn } from "@/lib/utils"
import { getPublicSellerDisplayName } from "@/lib/listing-labels"
import {
  resolveSellerProfileDisplayImageUrl,
  type ListingImageSourcePick,
} from "@/lib/sellers/profile-display-image"
import { ListingBuyerOnly } from "@/components/features/listings/listing-buyer-only"
import { ListingProtectionRibbonSlot } from "@/components/features/listings/listing-protection-ribbon-slot"
import { MarketplaceReviewPhotos } from "@/components/features/reviews/marketplace-review-photos"
import { marketplaceReviewPhotoRefs } from "@/lib/marketplace-review-photos"

const STAR_FILL = ratingStarFilledClassName
const STAR_EMPTY = ratingStarEmptyClassName

export type SellerReviewPreviewRow = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  metadata?: unknown
}

type ReviewerEmbed =
  | { display_name?: string | null }
  | { display_name?: string | null }[]
  | null
  | undefined

function StarRowAvg({ value, size }: { value: number; size: "sm" | "md" }) {
  const clamped = Math.min(5, Math.max(0, value))
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, clamped - i))
        return (
          <span key={i} className={cn("relative inline-flex shrink-0", dim)}>
            <Star className={cn("absolute inset-0", dim, STAR_EMPTY)} strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn(dim, STAR_FILL)} strokeWidth={0} />
            </span>
          </span>
        )
      })}
    </div>
  )
}

function reviewerDisplayName(embed: ReviewerEmbed): string {
  if (!embed) return "Verified buyer"
  const row = Array.isArray(embed) ? embed[0] : embed
  const name = row?.display_name?.trim()
  return name && name.length > 0 ? name : "Verified buyer"
}

export type { ListingProtectionTrustRibbonViewer } from "@/components/features/listings/listing-protection-trust-ribbon"
export { ListingBuyerProtectionTrustRibbon, ListingProtectionTrustRibbon } from "@/components/features/listings/listing-protection-trust-ribbon"

interface ListingAboutSellerSectionProps {
  profiles: {
    id: string
    avatar_url?: string | null
    is_shop?: boolean | null
    shop_logo_url?: string | null
    location?: string | null
    created_at?: string | null
    display_name?: string | null
    shop_name?: string | null
    shop_verified?: boolean | null
  } | null
  sellerProfileHref: string
  messageHrefAuthenticated: string
  messageHrefLoginRedirect: string
  isLoggedIn: boolean
  isOwnListing: boolean
  isSold: boolean
  avgRating: number
  reviewCount: number
  itemsSold: number
  previewReviews: (SellerReviewPreviewRow & { reviewer?: ReviewerEmbed })[]
  /** When false, omit the trust ribbon (e.g. rendered elsewhere on the PDP). */
  showTrustRibbon?: boolean
  /** Listing photos when the seller has no profile image (e.g. current PDP listing). */
  listingImageFallbacks?: ListingImageSourcePick[]
}

/** Reverb-style “About the seller” rail (profile, accordions, trust ribbon). */
export function ListingAboutSellerSection({
  profiles,
  sellerProfileHref,
  messageHrefAuthenticated,
  messageHrefLoginRedirect,
  isLoggedIn,
  isOwnListing,
  isSold,
  avgRating,
  reviewCount,
  itemsSold,
  previewReviews,
  showTrustRibbon = true,
  listingImageFallbacks,
}: ListingAboutSellerSectionProps) {
  const displayName = getPublicSellerDisplayName(profiles)
  const avatarSrc = resolveSellerProfileDisplayImageUrl(
    {
      is_shop: profiles?.is_shop,
      shop_logo_url: profiles?.shop_logo_url,
      avatar_url: profiles?.avatar_url,
    },
    listingImageFallbacks,
  )
  const locationLine = profiles?.location?.trim() || null
  const effectiveReviewCount = Math.max(reviewCount, previewReviews.length)

  let joinYear = ""
  if (profiles?.created_at) {
    const d = new Date(profiles.created_at)
    if (!Number.isNaN(d.getTime())) {
      joinYear = String(d.getFullYear())
    }
  }

  const messageHref = isLoggedIn ? messageHrefAuthenticated : messageHrefLoginRedirect

  // `/messages/new?user={sellerId}&listing={listingId}` — drives the in-page popup.
  const composeParams = new URLSearchParams(messageHrefAuthenticated.split("?")[1] ?? "")
  const composeUserId = composeParams.get("user")
  const composeListingId = composeParams.get("listing")
  const canUseMessageDialog = isLoggedIn && !!composeUserId && !!composeListingId

  const showActions = !isOwnListing && !isSold

  const messageButtonClassName =
    "min-h-touch w-full rounded-full border-0 bg-[#f2f3f5] px-5 py-2.5 text-[16px] font-semibold text-foreground shadow-none hover:bg-[#e8e9ec] dark:bg-secondary dark:hover:bg-secondary/80"

  return (
    <section className="border-b border-neutral-200/90 pb-6 dark:border-neutral-700/70 max-lg:border-b-0 max-lg:pb-0">
      <h2 className="text-[1.375rem] font-bold tracking-tight text-foreground">About the seller</h2>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <Link
          href={sellerProfileHref}
          prefetch={false}
          className="group flex min-w-0 gap-4 transition-opacity hover:opacity-[0.92]"
        >
          <Avatar className="h-[4.25rem] w-[4.25rem] shrink-0 ring-2 ring-neutral-100 dark:ring-neutral-800">
            <AvatarImage src={avatarSrc} alt="" />
            <AvatarFallback className="text-lg font-semibold">
              {displayName.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 pt-0.5">
            <p className="flex flex-wrap items-center gap-2 truncate text-[18px] font-bold tracking-tight text-foreground">
              <span className="truncate">{displayName}</span>
              {profiles?.shop_verified ? <VerifiedBadge size="sm" /> : null}
            </p>
            {locationLine ? (
              <p className="mt-1.5 truncate text-[16px] text-neutral-600 dark:text-neutral-400">
                {locationLine}
              </p>
            ) : null}
            {joinYear ? (
              <p className="mt-2.5 text-[16px] font-medium leading-none text-foreground">
                Joined Reswell: {joinYear}
              </p>
            ) : null}
          </div>
        </Link>

        {showActions ? (
          <ListingBuyerOnly>
            <div className="flex w-full shrink-0 flex-col gap-[10px] lg:mt-0 lg:w-[min(100%,246px)]">
            {canUseMessageDialog ? (
              <MessageSellerDialog
                listingId={composeListingId}
                sellerId={composeUserId}
                sellerDisplayName={displayName}
                sellerAvatarSrc={avatarSrc}
                sellerShopVerified={!!profiles?.shop_verified}
                triggerClassName={messageButtonClassName}
              />
            ) : (
              <Button variant="secondary" size="lg" asChild className={messageButtonClassName}>
                <Link href={messageHref} prefetch={false}>
                  <MessageSquare className="mr-2 h-[18px] w-[18px]" aria-hidden />
                  Message Seller
                </Link>
              </Button>
            )}
            <Button
              variant="secondary"
              size="lg"
              asChild
              className={messageButtonClassName}
            >
              <Link href={sellerProfileHref} prefetch={false}>
                View more from this shop
              </Link>
            </Button>
            </div>
          </ListingBuyerOnly>
        ) : null}
      </div>

      <Accordion type="multiple" className="mt-8 w-full border-t border-neutral-200/90 dark:border-neutral-700/70">
        <AccordionItem value="reviews" className="border-neutral-200/90 dark:border-neutral-700/70">
          <AccordionTrigger className="items-center py-4 text-left hover:no-underline [&>svg]:shrink-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-4">
              <span className="text-[16px] font-bold text-foreground">Seller reviews ({effectiveReviewCount})</span>
              <StarRowAvg value={effectiveReviewCount > 0 ? avgRating : 0} size="md" />
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-5 pt-1">
            {effectiveReviewCount === 0 ? (
              <p className="text-[15px] text-muted-foreground">
                No reviews yet. After a purchase completes, buyers may leave seller feedback—check back soon.
              </p>
            ) : (
              <ul className="space-y-4">
                {previewReviews.map((rv) => {
                  const nm = reviewerDisplayName(rv.reviewer)
                  const dt = new Date(rv.created_at)
                  const dtLabel = Number.isNaN(dt.getTime())
                    ? ""
                    : dt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                  return (
                    <li
                      key={rv.id}
                      className="rounded-lg border border-neutral-100 bg-neutral-50/80 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900/50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <StarRowAvg value={rv.rating} size="sm" />
                        {dtLabel ? (
                          <time className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                            {dtLabel}
                          </time>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-[15px] font-semibold text-foreground">{nm}</p>
                      {rv.comment?.trim() ? (
                        <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">
                          {rv.comment.trim()}
                        </p>
                      ) : (
                        <p className="mt-1 text-[14px] text-muted-foreground">
                          Rated {Number.isFinite(Number(rv.rating)) ? Number(rv.rating).toFixed(0) : "—"}★
                        </p>
                      )}
                      <MarketplaceReviewPhotos
                        reviewId={rv.id}
                        photos={marketplaceReviewPhotoRefs(rv.metadata)}
                        size="sm"
                      />
                    </li>
                  )
                })}
                <li className="pt-2 text-[15px] text-muted-foreground">
                  Items sold ·{" "}
                  <span className="font-semibold tabular-nums text-foreground/90">{itemsSold}</span>
                  {effectiveReviewCount > previewReviews.length ? (
                    <>
                      {" "}
                      ·{" "}
                      <Link
                        href={sellerProfileHref}
                        className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                      >
                        View all feedback on seller profile
                      </Link>
                    </>
                  ) : null}
                </li>
              </ul>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {showTrustRibbon ? <ListingProtectionRibbonSlot placement="about" /> : null}
    </section>
  )
}

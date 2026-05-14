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
import {
  ShieldCheck,
  Lock,
  MessageSquare,
  Star,
} from "lucide-react"
import { ratingStarEmptyClassName, ratingStarFilledClassName } from "@/lib/rating-star-styles"
import { cn } from "@/lib/utils"
import { getPublicSellerDisplayName } from "@/lib/listing-labels"
import {
  reswellProtectionCardClassName,
  reswellProtectionTrustRibbonColumnDividerClassName,
} from "@/lib/reswell-protection-surface"

const STAR_FILL = ratingStarFilledClassName
const STAR_EMPTY = ratingStarEmptyClassName

export type SellerReviewPreviewRow = {
  id: string
  rating: number
  comment: string | null
  created_at: string
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

export type ListingProtectionTrustRibbonViewer = "buyer" | "seller"

/** Reswell protection + secure checkout callout (shared PDP placement). */
export function ListingProtectionTrustRibbon({
  className,
  viewerRole = "buyer",
}: {
  className?: string
  /** When `seller`, copy speaks to the listing owner viewing their own listing. */
  viewerRole?: ListingProtectionTrustRibbonViewer
}) {
  const isSellerView = viewerRole === "seller"

  const protectionTitle = isSellerView ? "Reswell sellers protection" : "Reswell protection"
  const protectionBody = isSellerView
    ? "Eligible sales through checkout follow clear Purchase Protection rules—you're not charged an extra fee for it. Approved buyer refunds are funded from our marketplace fee; your agreed seller share stays as promised."
    : "Guided returns on eligible purchases, secure transactions through checkout, real support when you need it."
  const protectionPolicyHref = isSellerView ? "/protection-policy#seller-protections" : "/protection-policy"

  return (
    <div
      className={cn(
        "rounded-xl px-5 py-5",
        reswellProtectionCardClassName,
        !isSellerView && "grid gap-4 sm:grid-cols-2",
        className,
      )}
    >
      <div className="flex gap-3">
        <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#4263eb]" aria-hidden />
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-foreground">{protectionTitle}</p>
          <p className="mt-1 text-[14px] leading-snug text-neutral-700 dark:text-neutral-300">
            {protectionBody}
          </p>
          <Link
            href={protectionPolicyHref}
            className="mt-2 inline-block text-[14px] font-semibold underline underline-offset-4"
          >
            Learn more
          </Link>
        </div>
      </div>
      {!isSellerView ? (
        <div className={cn("flex gap-3", reswellProtectionTrustRibbonColumnDividerClassName)}>
          <Lock className="mt-0.5 h-6 w-6 shrink-0 text-[#4263eb]" aria-hidden />
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-foreground">Secure checkout</p>
            <p className="mt-1 text-[14px] leading-snug text-neutral-700 dark:text-neutral-300">
              At Reswell, your safety comes first—we use industry-standard encryption every time you pay.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Buyer-oriented Reswell protection callout for the left column PDP (below about the seller).
 */
export function ListingBuyerProtectionTrustRibbon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full gap-3 rounded-xl px-5 py-5",
        reswellProtectionCardClassName,
        className,
      )}
    >
      <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#4263eb]" aria-hidden />
      <div className="min-w-0">
        <p className="text-[15px] font-bold text-foreground">Reswell protection</p>
        <p className="mt-1 text-[14px] leading-snug text-neutral-700 dark:text-neutral-300">
          Shop knowing eligible purchases include Purchase Protection—clear coverage rules, a dispute path if the
          item isn&apos;t as described, and our team when you need a hand.
        </p>
        <Link
          href="/protection-policy"
          className="mt-2 inline-block text-[14px] font-semibold underline underline-offset-4"
        >
          Learn more
        </Link>
      </div>
    </div>
  )
}

interface ListingAboutSellerSectionProps {
  profiles: {
    id: string
    avatar_url?: string | null
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
}: ListingAboutSellerSectionProps) {
  const displayName = getPublicSellerDisplayName(profiles)
  const avatarSrc = profiles?.avatar_url ?? ""
  const locationLine = profiles?.location?.trim() || null

  let joinYear = ""
  if (profiles?.created_at) {
    const d = new Date(profiles.created_at)
    if (!Number.isNaN(d.getTime())) {
      joinYear = String(d.getFullYear())
    }
  }

  const messageHref = isLoggedIn ? messageHrefAuthenticated : messageHrefLoginRedirect

  const showActions = !isOwnListing && !isSold

  return (
    <section className="border-b border-neutral-200/90 pb-6 dark:border-neutral-700/70">
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
          <div className="flex w-full shrink-0 flex-col gap-[10px] lg:mt-0 lg:w-[min(100%,246px)]">
            <Button
              variant="secondary"
              size="lg"
              asChild
              className="min-h-touch w-full rounded-full border-0 bg-[#f2f3f5] px-5 py-2.5 text-[16px] font-semibold text-foreground shadow-none hover:bg-[#e8e9ec] dark:bg-secondary dark:hover:bg-secondary/80"
            >
              <Link href={messageHref} prefetch={false}>
                <MessageSquare className="mr-2 h-[18px] w-[18px]" aria-hidden />
                Message Seller
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              asChild
              className="min-h-touch w-full rounded-full border-0 bg-[#f2f3f5] px-5 py-2.5 text-[16px] font-semibold text-foreground shadow-none hover:bg-[#e8e9ec] dark:bg-secondary dark:hover:bg-secondary/80"
            >
              <Link href={sellerProfileHref} prefetch={false}>
                View more from this shop
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      <Accordion type="multiple" className="mt-8 w-full border-t border-neutral-200/90 dark:border-neutral-700/70">
        <AccordionItem value="reviews" className="border-neutral-200/90 dark:border-neutral-700/70">
          <AccordionTrigger className="items-center py-4 text-left hover:no-underline [&>svg]:shrink-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-4">
              <span className="text-[16px] font-bold text-foreground">Seller reviews ({reviewCount})</span>
              <StarRowAvg value={reviewCount > 0 ? avgRating : 0} size="md" />
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-5 pt-1">
            {reviewCount === 0 ? (
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
                        <p className="mt-1 text-[14px] text-muted-foreground">Rated {rv.rating.toFixed(0)}★</p>
                      )}
                    </li>
                  )
                })}
                <li className="pt-2 text-[15px] text-muted-foreground">
                  Items sold ·{" "}
                  <span className="font-semibold tabular-nums text-foreground/90">{itemsSold}</span>
                  {reviewCount > previewReviews.length ? (
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

      {showTrustRibbon ? (
        <ListingProtectionTrustRibbon
          className="mt-5"
          viewerRole={isOwnListing ? "seller" : "buyer"}
        />
      ) : null}
    </section>
  )
}

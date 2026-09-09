import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { VerifiedBadge } from "@/components/verified-badge"
import type { HowToSellShopSpotlight } from "@/lib/types/seller-resources-how-to-sell"

function ShopSpotlightCard({ shop }: { shop: HowToSellShopSpotlight }) {
  const reviewLabel =
    shop.reviewCount > 0
      ? `${shop.avgRating.toFixed(1)} out of 5 stars from ${shop.reviewCount.toLocaleString()} reviews`
      : undefined

  return (
    <article className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-border">
      <Link href={shop.href} className="flex gap-3 transition-opacity hover:opacity-90">
        <Avatar className="h-14 w-14 shrink-0 ring-2 ring-[#F4F7FB]">
          <AvatarImage src={shop.avatarSrc} alt="" />
          <AvatarFallback className="text-lg font-semibold">
            {shop.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold text-[#001A4A]">
            <span className="truncate">{shop.name}</span>
            {shop.verified ? <VerifiedBadge size="sm" /> : null}
          </p>
          {shop.location ? (
            <p className="mt-0.5 text-xs text-[#5c6b89]">{shop.location}</p>
          ) : null}
          {shop.reviewCount > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5" aria-label={reviewLabel}>
              <SellerRatingStarRow value={shop.avgRating} size="sm" />
              <span className="text-xs tabular-nums text-[#5c6b89]">
                {shop.avgRating.toFixed(1)} ({shop.reviewCount.toLocaleString()})
              </span>
            </div>
          ) : null}
          {shop.salesCount > 0 ? (
            <p className="mt-1 text-xs font-medium text-[#5574AD]">
              {shop.salesCount.toLocaleString()} sales on Reswell
            </p>
          ) : null}
        </div>
      </Link>

      {shop.reviews.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {shop.reviews.map((review) => (
            <li key={review.id} className="rounded-xl bg-[#F4F7FB] px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SellerRatingStarRow value={review.rating} size="sm" />
                {review.createdAtLabel ? (
                  <time className="text-[11px] font-medium uppercase tracking-wide text-[#5574AD]">
                    {review.createdAtLabel}
                  </time>
                ) : null}
              </div>
              <p className="mt-1 text-[13px] font-semibold text-[#001A4A]">{review.reviewerName}</p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#5c6b89]">
                {review.comment}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <Link
        href={shop.href}
        className="mt-3 inline-block text-sm font-medium text-[#001A4A] underline underline-offset-2"
      >
        View shop and all feedback
      </Link>
    </article>
  )
}

export function HowToSellShopSpotlights({ shops }: { shops: HowToSellShopSpotlight[] }) {
  return (
    <HowToSellSection
      id="reviews"
      wash
      eyebrow="Reviews"
      title="Build a shop buyers trust"
      lead="After a completed sale, buyers leave a star rating on your profile. Honest photos, the right box size, and fast shipping add up — Hayden Garfield Shop and OutSurfing sold that way."
    >
      {shops.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {shops.map((shop) => (
            <ShopSpotlightCard key={shop.id} shop={shop} />
          ))}
        </div>
      ) : null}
    </HowToSellSection>
  )
}

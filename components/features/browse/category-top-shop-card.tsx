import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { Award, Package } from "lucide-react"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { VerifiedBadge } from "@/components/verified-badge"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { CategoryTopShop } from "@/lib/types/category-top-shops"
import { cn } from "@/lib/utils"

function ShopBadgeIcon({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
      title={label}
      aria-label={label}
    >
      {children}
    </span>
  )
}

export function CategoryTopShopCard({ shop }: { shop: CategoryTopShop }) {
  const reviewLabel =
    shop.reviewCount > 0
      ? `${shop.avgRating.toFixed(1)} out of 5 stars from ${shop.reviewCount.toLocaleString()} reviews`
      : undefined

  return (
    <article className="min-w-0">
      <Link
        href={shop.href}
        className="group flex min-w-0 flex-col outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
          {shop.imageSrc ? (
            <Image
              src={shop.imageSrc}
              alt=""
              fill
              draggable={false}
              sizes="(max-width: 639px) 40svw, 176px"
              className={cn(
                "pointer-events-none",
                shop.imageFit === "contain"
                  ? "object-contain object-center p-3"
                  : "object-cover object-center",
              )}
              unoptimized={listingImageShouldBypassOptimization(shop.imageSrc)}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground"
              aria-hidden
            >
              {shop.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <h3 className="mt-2.5 break-words text-[15px] font-bold leading-snug text-foreground group-hover:underline">
          {shop.name}
        </h3>

        {shop.locationLabel ? (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{shop.locationLabel}</p>
        ) : null}

        {shop.reviewCount > 0 ? (
          <div className="mt-1 flex min-w-0 items-center gap-1" role="img" aria-label={reviewLabel}>
            <SellerRatingStarRow value={shop.avgRating} size="sm" className="shrink-0" />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              ({shop.reviewCount.toLocaleString()})
            </span>
          </div>
        ) : null}

        <div className="mt-2 flex items-center gap-1.5">
          {shop.shopVerified ? (
            <VerifiedBadge size="sm" />
          ) : (
            <ShopBadgeIcon label="Top seller">
              <Award className="h-3 w-3" aria-hidden />
            </ShopBadgeIcon>
          )}
          {shop.completedShipping ? (
            <ShopBadgeIcon label="Completed shipping sales">
              <Package className="h-3 w-3" aria-hidden />
            </ShopBadgeIcon>
          ) : null}
        </div>
      </Link>
    </article>
  )
}

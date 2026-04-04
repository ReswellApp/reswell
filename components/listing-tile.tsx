import Link from "next/link"
import Image from "next/image"
import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  listingCardImageSrc,
  type ListingImageForCard,
} from "@/lib/listing-image-display"
import { portraitShimmer, squareShimmer } from "@/lib/image-shimmer"
import { FavoriteButtonCardOverlay } from "@/components/favorite-button-card-overlay"
import { ListingTileCategoryPill } from "@/components/listing-tile-category-pill"
import { ListingTileCheckoutBasketIcon } from "@/components/listing-tile-checkout-basket-icon"
import { ListingTileAddToCartIcon, type ListingTileCartItem } from "@/components/listing-tile-add-to-cart-icon"
import { VerifiedBadge } from "@/components/verified-badge"
import { listingProductCardGridClassName } from "@/lib/listing-card-styles"

const DEFAULT_IMAGE_SIZES =
  "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw"

export type ListingTileLinkLayout = "unified" | "split"

export type ListingTilePriceAction =
  | {
      type: "checkout"
      checkoutPath: string
      isLoggedIn: boolean
    }
  | {
      type: "addToCart"
      item: ListingTileCartItem
    }

export type ListingTileMeta =
  | {
      variant: "seller"
      name: string
      verified?: boolean
      /** Home scroll rows: line-clamp seller name; default false = single-line with badge. */
      multiline?: boolean
    }
  | { variant: "location"; text: string; showMapPin?: boolean }

export interface ListingTileProps {
  href: string
  listingId: string
  title: string
  price: number

  listingImages?: ListingImageForCard[] | null
  imageUrl?: string | null
  imageAlt: string

  imageSizes?: string
  imageAspect?: "portrait" | "square"
  imageFit?: "cover" | "contain"
  imageClassName?: string
  imageGrayscale?: boolean

  useBlurPlaceholder?: boolean
  blurDataURL?: string

  cardClassName?: string
  linkLayout?: ListingTileLinkLayout
  linkClassName?: string
  imageLinkClassName?: string
  cardContentClassName?: string

  favorites?: {
    initialFavorited: boolean
    isLoggedIn: boolean
    onFavoritedChange?: (favorited: boolean) => void
  } | null
  showFavorites?: boolean

  titleSlot?: ReactNode
  titleClassName?: string
  subtitle?: ReactNode

  compareAtPrice?: number | null

  priceAction?: ListingTilePriceAction | null

  /** Inserted after the price row (e.g. saved list: seller + location lines). */
  afterPriceSlot?: ReactNode

  /**
   * When set (e.g. homepage uniform scroll), replaces default price + meta + pill.
   * Use for fixed-height title bands + `mt-auto` footers.
   */
  footerSlot?: ReactNode

  meta?: ListingTileMeta | null
  metaRowClassName?: string

  categoryPill?: string | null

  statusLabel?: "sold" | "pending" | "ended" | null

  soldOverlay?: boolean

  variant?: "default" | "soldFeed"
  soldPrice?: number
  soldFootnote?: ReactNode

  trailingInsideCard?: ReactNode

  children?: ReactNode
}

function resolveSrc(
  listingImages: ListingImageForCard[] | null | undefined,
  imageUrl: string | null | undefined,
): string {
  if (listingImages?.length) {
    const s = listingCardImageSrc(listingImages)
    if (s) return s
  }
  if (imageUrl?.trim()) return imageUrl.trim()
  return ""
}

export function ListingTile({
  href,
  listingId,
  title,
  price,
  listingImages,
  imageUrl,
  imageAlt,
  imageSizes = DEFAULT_IMAGE_SIZES,
  imageAspect = "portrait",
  imageFit = "cover",
  imageClassName,
  imageGrayscale,
  useBlurPlaceholder = true,
  blurDataURL,
  cardClassName = listingProductCardGridClassName,
  linkLayout = "split",
  linkClassName,
  imageLinkClassName,
  cardContentClassName,
  favorites,
  showFavorites = true,
  titleSlot,
  titleClassName = "text-sm font-medium line-clamp-2 min-h-[2.8em]",
  subtitle,
  compareAtPrice,
  priceAction,
  afterPriceSlot,
  footerSlot,
  meta,
  metaRowClassName,
  categoryPill,
  statusLabel,
  soldOverlay,
  variant = "default",
  soldPrice,
  soldFootnote,
  trailingInsideCard,
  children,
}: ListingTileProps) {
  const src = resolveSrc(listingImages ?? null, imageUrl ?? null)
  const hasImage = Boolean(src)
  const defaultBlur =
    blurDataURL ?? (imageAspect === "square" ? squareShimmer : portraitShimmer)
  const aspectClass =
    imageAspect === "square" ? "aspect-square" : "aspect-[3/4]"
  const objectStyle =
    imageFit === "contain"
      ? ({ objectFit: "contain" } as const)
      : ({ objectFit: "cover" } as const)

  const showSoldFeed = variant === "soldFeed"

  const imageBlock = (
    <div
      className={cn(
        aspectClass,
        "w-full relative bg-muted overflow-hidden",
        imageAspect === "portrait" && linkLayout === "unified" && "shrink-0",
      )}
    >
      {hasImage ? (
        <Image
          src={src}
          alt={imageAlt}
          fill
          sizes={imageSizes}
          className={cn(
            "transition-transform duration-300 group-hover:scale-105",
            imageFit === "cover" && "object-cover",
            imageFit === "contain" && "object-contain",
            imageGrayscale && "[filter:grayscale(30%)]",
            imageClassName,
          )}
          style={objectStyle}
          {...(useBlurPlaceholder
            ? { placeholder: "blur" as const, blurDataURL: defaultBlur }
            : {})}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          No Image
        </div>
      )}
      {showSoldFeed && (
        <div
          className="absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: "#111" }}
        >
          SOLD
        </div>
      )}
      {showFavorites && favorites && (
        <FavoriteButtonCardOverlay
          listingId={listingId}
          initialFavorited={favorites.initialFavorited}
          isLoggedIn={favorites.isLoggedIn}
          onFavoritedChange={favorites.onFavoritedChange}
        />
      )}
      {soldOverlay && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <span className="text-sm font-semibold text-foreground">SOLD</span>
        </div>
      )}
    </div>
  )

  const titleBlock =
    titleSlot ??
    (linkLayout === "split" ? (
      <Link href={href} className="min-w-0 text-foreground hover:text-primary">
        <h3 className={titleClassName}>{title}</h3>
      </Link>
    ) : (
      <h3 className={titleClassName}>{title}</h3>
    ))

  const priceRowDefault = (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-2",
        linkLayout === "split" && "mt-1",
        linkLayout === "unified" && (subtitle ? "mt-2" : "mt-1"),
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <p className="text-base font-bold text-black dark:text-white tabular-nums">
          ${price.toFixed(2)}
        </p>
        {compareAtPrice != null && compareAtPrice > price ? (
          <p className="text-sm text-muted-foreground line-through tabular-nums">
            ${compareAtPrice.toFixed(2)}
          </p>
        ) : null}
      </div>
      {priceAction?.type === "checkout" ? (
        <ListingTileCheckoutBasketIcon
          checkoutHref={priceAction.checkoutPath}
          loginHref={`/auth/login?redirect=${encodeURIComponent(priceAction.checkoutPath)}`}
          isLoggedIn={priceAction.isLoggedIn}
        />
      ) : priceAction?.type === "addToCart" ? (
        <ListingTileAddToCartIcon item={priceAction.item} />
      ) : null}
    </div>
  )

  const metaAndPillRow =
    meta || categoryPill ? (
      <div
        className={cn(
          "mt-1 flex items-start justify-between gap-1",
          meta?.variant === "location" && !metaRowClassName && "mt-2",
          metaRowClassName,
        )}
      >
        {meta?.variant === "seller" ? (
          <p
            className={cn(
              "text-xs text-muted-foreground flex min-w-0 items-center gap-1",
              meta.multiline && "min-w-0 flex-1",
            )}
          >
            <span
              className={cn(
                meta.multiline
                  ? "min-w-0 flex-1 break-words line-clamp-2 leading-snug"
                  : "min-w-0 truncate",
              )}
            >
              {meta.name}
            </span>
            {meta.verified && (
              <VerifiedBadge size="sm" className={cn("shrink-0", meta.multiline && "mt-0.5")} />
            )}
          </p>
        ) : meta?.variant === "location" ? (
          <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground">
            {meta.showMapPin !== false && <MapPin className="h-3 w-3 shrink-0" />}
            <span className="truncate">{meta.text}</span>
          </div>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        <ListingTileCategoryPill label={categoryPill} />
      </div>
    ) : categoryPill ? (
      <div className="mt-1 flex justify-end">
        <ListingTileCategoryPill label={categoryPill} />
      </div>
    ) : null

  const bodyInner =
    children ??
    (showSoldFeed ? (
      <>
        {titleBlock}
        {subtitle}
        {soldPrice != null ? (
          <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
            Sold for ${soldPrice.toFixed(2)}
          </p>
        ) : null}
        <div className="mt-2 flex items-start justify-between gap-1">
          {soldFootnote != null ? (
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">{soldFootnote}</div>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          <ListingTileCategoryPill label={categoryPill} />
        </div>
      </>
    ) : footerSlot ? (
      <>
        {titleBlock}
        {subtitle}
        {footerSlot}
      </>
    ) : (
      <>
        {titleBlock}
        {subtitle}
        {linkLayout === "unified" && !priceAction && compareAtPrice == null ? (
          <p
            className={cn(
              "text-base font-bold text-black dark:text-white",
              subtitle ? "mt-2" : "mt-1",
            )}
          >
            ${price.toFixed(2)}
          </p>
        ) : (
          priceRowDefault
        )}
        {statusLabel ? (
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {statusLabel === "sold"
              ? "Sold"
              : statusLabel === "pending"
                ? "Pending"
                : "Ended"}
          </p>
        ) : null}
        {afterPriceSlot}
        {metaAndPillRow}
      </>
    ))

  const content = (
    <CardContent
      className={cn(
        "min-w-0 p-3",
        linkLayout === "unified" && "flex min-w-0 flex-1 flex-col",
        cardContentClassName,
      )}
    >
      {bodyInner}
    </CardContent>
  )

  if (linkLayout === "unified") {
    return (
      <Card className={cardClassName}>
        <Link href={href} className={cn("min-w-0 flex-1 flex flex-col", linkClassName)}>
          {imageBlock}
          {content}
        </Link>
        {trailingInsideCard}
      </Card>
    )
  }

  return (
    <Card className={cardClassName}>
      <Link href={href} className={cn("block min-w-0 shrink-0", imageLinkClassName)}>
        {imageBlock}
      </Link>
      {content}
      {trailingInsideCard}
    </Card>
  )
}

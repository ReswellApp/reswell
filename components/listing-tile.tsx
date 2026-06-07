import Link from "next/link"
import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  listingCardImageSrc,
  listingTileCarouselImageUrls,
  type ListingImageForCard,
} from "@/lib/listing-image-display"
import { FavoriteButtonCardOverlay } from "@/components/favorite-button-card-overlay"
import { ListingTileImageMedia } from "@/components/listing-tile-image-media"
import { ListingTileCategoryPill } from "@/components/listing-tile-category-pill"
import { ListingTileCheckoutBasketIcon } from "@/components/listing-tile-checkout-basket-icon"
import { ListingTileAddToCartIcon, type ListingTileCartItem } from "@/components/listing-tile-add-to-cart-icon"
import { ListingTileAddToCartServerIcon } from "@/components/listing-tile-add-to-cart-server-icon"
import { VerifiedBadge } from "@/components/verified-badge"
import {
  listingProductCardGridClassName,
  listingTileTitleHeadingClassName,
} from "@/lib/listing-card-styles"

const DEFAULT_IMAGE_SIZES =
  "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw"

/** Top-left “SOLD” stamp on listing tile imagery. */
export function ListingTileSoldStamp() {
  return (
    <div
      className="absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
      style={{ backgroundColor: "#111" }}
    >
      SOLD
    </div>
  )
}

const tilePriceActionRevealClass =
  "opacity-0 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:opacity-100"

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
  | {
      type: "addToCartServer"
      listingId: string
      isLoggedIn: boolean
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

  /** Optional badge or label over the image top-left (e.g. “SOLD” on sold feed). */
  imageTopLeftOverlay?: ReactNode

  imageSizes?: string
  imageAspect?: "portrait" | "square"
  imageFit?: "cover" | "contain"
  imageClassName?: string
  /** Forwarded to ListingTileImageMedia — see its JSDoc for usage rules. */
  imagePriority?: boolean

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
  imageTopLeftOverlay,
  imageSizes = DEFAULT_IMAGE_SIZES,
  imageAspect = "portrait",
  imageFit = "cover",
  imageClassName,
  imagePriority = false,
  cardClassName = listingProductCardGridClassName,
  linkLayout = "split",
  linkClassName,
  imageLinkClassName,
  cardContentClassName,
  favorites,
  showFavorites = true,
  titleSlot,
  titleClassName = cn(listingTileTitleHeadingClassName, "line-clamp-3"),
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
  trailingInsideCard,
  children,
}: ListingTileProps) {
  const src = resolveSrc(listingImages ?? null, imageUrl ?? null)
  const carouselProxiedUrls = listingTileCarouselImageUrls(listingImages ?? null)
  const tileImageUrls =
    carouselProxiedUrls.length > 0 ? carouselProxiedUrls : src ? [src] : []
  const aspectClass =
    imageAspect === "square" ? "aspect-square" : "aspect-[3/4]"

  const favoriteOverlay =
    showFavorites && favorites ? (
      <FavoriteButtonCardOverlay
        listingId={listingId}
        initialFavorited={favorites.initialFavorited}
        isLoggedIn={favorites.isLoggedIn}
        onFavoritedChange={favorites.onFavoritedChange}
      />
    ) : null

  const imageBlock = (
    <ListingTileImageMedia
      urls={tileImageUrls}
      imageAlt={imageAlt}
      imageSizes={imageSizes}
      aspectClass={aspectClass}
      imageAspect={imageAspect}
      linkLayoutUnified={linkLayout === "unified"}
      imageFit={imageFit}
      imageClassName={imageClassName}
      imagePriority={imagePriority}
      overlayTopLeft={imageTopLeftOverlay ?? null}
      overlayBottomRight={favoriteOverlay}
      overlayFull={
        soldOverlay ? (
          <div className="absolute inset-0 z-[25] flex items-center justify-center bg-background/80">
            <span className="text-sm font-semibold text-foreground">SOLD</span>
          </div>
        ) : null
      }
    />
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
        linkLayout === "unified" && "mt-1",
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
      {priceAction ? (
        <div className={tilePriceActionRevealClass}>
          {priceAction.type === "checkout" ? (
            <ListingTileCheckoutBasketIcon
              checkoutHref={priceAction.checkoutPath}
              loginHref={`/auth/login?redirect=${encodeURIComponent(priceAction.checkoutPath)}`}
              isLoggedIn={priceAction.isLoggedIn}
            />
          ) : priceAction.type === "addToCart" ? (
            <ListingTileAddToCartIcon item={priceAction.item} />
          ) : (
            <ListingTileAddToCartServerIcon
              listingId={priceAction.listingId}
              isLoggedIn={priceAction.isLoggedIn}
            />
          )}
        </div>
      ) : null}
    </div>
  )

  const categoryPillBelowPrice =
    categoryPill ? (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <ListingTileCategoryPill label={categoryPill} />
      </div>
    ) : null

  const metaOnlyRow =
    meta ? (
      <div
        className={cn(
          "flex min-w-0 items-start gap-1",
          categoryPill ? "mt-1" : meta.variant === "location" && !metaRowClassName ? "mt-2" : "mt-1",
          metaRowClassName,
        )}
      >
        {meta.variant === "seller" ? (
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
        ) : meta.variant === "location" ? (
          <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground">
            {meta.showMapPin !== false && <MapPin className="h-3 w-3 shrink-0" />}
            <span className="truncate">{meta.text}</span>
          </div>
        ) : null}
      </div>
    ) : null

  const bodyInner =
    children ??
    (footerSlot ? (
      <>
        {titleBlock}
        {subtitle}
        {statusLabel ? (
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {statusLabel === "sold"
              ? "Sold"
              : statusLabel === "pending"
                ? "Pending"
                : "Ended"}
          </p>
        ) : null}
        {footerSlot}
      </>
    ) : (
      <>
        {titleBlock}
        {subtitle}
        {linkLayout === "unified" && !priceAction && compareAtPrice == null ? (
          <p className="mt-1 text-base font-bold tabular-nums text-black dark:text-white">
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
        {categoryPillBelowPrice}
        {metaOnlyRow}
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

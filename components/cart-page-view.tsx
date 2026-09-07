"use client"

import { useMemo, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronLeft, Minus, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  clearCart,
  removeCartItem,
  updateCartItemQuantity,
  type CartPageItem,
} from "@/app/actions/cart"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { isReswellShopListing } from "@/lib/reswell-shop"
import { listingDetailHref } from "@/lib/listing-href"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { formatBoardType, formatCondition, getPublicSellerDisplayName } from "@/lib/listing-labels"
import { formatListingBoardLengthSubtitle } from "@/lib/listing-dimensions-display"
import { sellerProfileHref } from "@/lib/seller-slug"
import { VerifiedBadge } from "@/components/verified-badge"
import { CartBuyingFaq } from "@/components/features/cart/cart-buying-faq"
import { CartEmptyState } from "@/components/features/cart/cart-empty-state"
import {
  CartFavoritesCarousel,
  type CartCarouselFavoriteListing,
} from "@/components/features/cart/cart-favorites-carousel"
import { CartSellerAddonsCarousel } from "@/components/features/cart/cart-seller-addons-carousel"
import { CartOrderSummary } from "@/components/features/cart/cart-order-summary"
import type { CartSellerAddonCarouselItem } from "@/lib/services/cartSellerAddons"
import { cn } from "@/lib/utils"
import { FavoriteButton } from "@/components/favorite-button"

function listingAvailable(listing: CartPageItem["listing"]) {
  return listing.status === "active" || listing.status === "pending_sale"
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const linkMuted = "text-[14px] text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-foreground"

function CartLineFavoriteButton({
  listingId,
  initialFavorited,
}: {
  listingId: string
  initialFavorited: boolean
}) {
  return (
    <FavoriteButton
      listingId={listingId}
      initialFavorited={initialFavorited}
      isLoggedIn
      redirectPath="/cart"
      refreshAfterToggle
      heartAccent="listingTile"
      className="!h-9 !w-9 !min-h-9 !min-w-9 rounded-lg border-0 bg-neutral-100 text-neutral-600 shadow-none hover:border-0 hover:bg-neutral-200 hover:shadow-none hover:backdrop-blur-none focus-visible:ring-2 focus-visible:ring-foreground/15 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15 dark:hover:text-heartIcon"
    />
  )
}

export function CartPageView({
  initialItems,
  loadError,
  favoritedListingIds,
  favoriteCarouselListings,
  sellerAddonListings,
  sellerAddonSubtitle,
  sellerAddonViewAllHref,
  sellerAddonViewAllLabel,
  buyerId,
}: {
  initialItems: CartPageItem[]
  loadError: string | null
  favoritedListingIds: string[]
  favoriteCarouselListings: CartCarouselFavoriteListing[]
  sellerAddonListings: CartSellerAddonCarouselItem[]
  sellerAddonSubtitle: string
  sellerAddonViewAllHref: string | null
  sellerAddonViewAllLabel: string
  buyerId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const {
    availableTotal,
    availableCount,
    unavailableCount,
    checkoutActions,
    deliveryLabel,
    deliveryNote,
  } = useMemo(() => {
    let total = 0
    let unavail = 0
    let availUnits = 0
    for (const row of initialItems) {
      if (listingAvailable(row.listing)) {
        const qty = Math.max(1, row.quantity || 1)
        const unit =
          row.agreedPriceUsd != null && row.agreedPriceUsd > 0
            ? row.agreedPriceUsd
            : Number(row.listing.price)
        total += unit * qty
        availUnits += qty
      } else {
        unavail += 1
      }
    }

    const availRows = initialItems.filter(({ listing }) => listingAvailable(listing))
    const peerRows = availRows.filter(({ listing }) => isPeerListingSection(listing.section))
    const shopRows = availRows.filter(({ listing }) => isReswellShopListing(listing.section))
    const shopUnits = shopRows.reduce((s, r) => s + Math.max(1, r.quantity || 1), 0)

    let shipLabel = "Calculated at checkout"
    if (availRows.length > 0) {
      const withShip = availRows.filter(({ listing }) => listing.shipping_available)
      if (withShip.length > 0) {
        const rates = withShip.map(({ listing }) => Math.max(0, parseFloat(String(listing.shipping_price ?? 0)) || 0))
        const hasReswell = withShip.some(({ listing }) => listing.board_shipping_cost_mode === "reswell")
        shipLabel =
          rates.every((r) => r === 0) && !hasReswell ? "FREE" : "Calculated at checkout"
      } else if (availRows.some(({ listing }) => listing.local_pickup !== false)) {
        shipLabel = "Pickup only"
      }
    }

    const peerSellerGroups = new Map<string, CartPageItem[]>()
    for (const row of peerRows) {
      const sid = row.listing.user_id
      const g = peerSellerGroups.get(sid) ?? []
      g.push(row)
      peerSellerGroups.set(sid, g)
    }

    const checkoutActionsInner: { href: string; label: string }[] = []

    if (peerSellerGroups.size === 0 && shopRows.length > 0) {
      const shopSellerId = shopRows[0]!.listing.user_id
      const q = new URLSearchParams()
      q.set("from_cart", "1")
      q.set("seller_id", shopSellerId)
      checkoutActionsInner.push({
        href: `/checkout?${q}`,
        label: `Checkout ${shopUnits === 1 ? "1 item" : `${shopUnits} items`}`,
      })
    } else {
      for (const [sellerId, rows] of peerSellerGroups) {
        const sellerName = getPublicSellerDisplayName(rows[0]!.listing.profiles)
        const peerUnits = rows.reduce((s, r) => s + Math.max(1, r.quantity || 1), 0)
        const n = peerUnits + shopUnits
        const label =
          peerSellerGroups.size > 1
            ? `Checkout ${n} ${n === 1 ? "item" : "items"} — ${sellerName}`
            : `Checkout ${n === 1 ? "1 item" : `${n} items`}`
        const q = new URLSearchParams()
        q.set("from_cart", "1")
        q.set("seller_id", sellerId)
        checkoutActionsInner.push({ href: `/checkout?${q}`, label })
      }
    }
    checkoutActionsInner.sort((a, b) => a.href.localeCompare(b.href))

    const sellerGroupCount = peerSellerGroups.size

    const maxSurfboardsInSellerGroup = Math.max(
      0,
      ...[...peerSellerGroups.values()].map(
        (rows) => rows.filter(({ listing }) => listing.section === "surfboards").length,
      ),
    )

    const note =
      sellerGroupCount > 1
        ? "Multiple sellers — checkout each group separately. Reswell shop items are included with whichever seller group you check out first."
        : maxSurfboardsInSellerGroup >= 2
          ? "These surfboards can ship together in one box or separately — choose at checkout. Live shipping is quoted from your address."
          : shopRows.length > 0 && peerRows.length > 0
            ? "Peer listings and Reswell shop items check out together in one payment."
            : availRows.length > 0 && availRows.some(({ listing }) => listing.shipping_available)
              ? "Shipping cost and delivery timing are finalized at checkout."
              : "Pickup or shipping details are confirmed when you check out."

    return {
      availableTotal: total,
      availableCount: availUnits,
      unavailableCount: unavail,
      checkoutActions: checkoutActionsInner,
      deliveryLabel: shipLabel,
      deliveryNote: note,
    }
  }, [initialItems])

  function remove(listingId: string) {
    startTransition(async () => {
      const r = await removeCartItem(listingId)
      if (!r.ok) {
        toast.error(r.error ?? "Could not remove")
        return
      }
      window.dispatchEvent(new CustomEvent("cartUpdated"))
      router.refresh()
    })
  }

  function setQty(listingId: string, quantity: number) {
    startTransition(async () => {
      const r = await updateCartItemQuantity(listingId, quantity)
      if (!r.ok) {
        toast.error(r.error ?? "Could not update quantity")
        return
      }
      window.dispatchEvent(new CustomEvent("cartUpdated"))
      router.refresh()
    })
  }

  function removeAll() {
    if (initialItems.length === 0) return
    if (!window.confirm("Remove all items from your cart?")) return
    startTransition(async () => {
      const r = await clearCart()
      if (!r.ok) {
        toast.error(r.error ?? "Could not clear cart")
        return
      }
      window.dispatchEvent(new CustomEvent("cartUpdated"))
      router.refresh()
    })
  }

  if (loadError) {
    return (
      <main className="flex-1 bg-white dark:bg-background">
        <div className="mx-auto max-w-xl px-5 py-20 md:px-6">
          <p className="text-[15px] leading-relaxed text-destructive">{loadError}</p>
          <Button asChild variant="outline" className="mt-6 rounded-lg" size="sm">
            <Link href="/boards">Continue shopping</Link>
          </Button>
        </div>
      </main>
    )
  }

  if (initialItems.length === 0) {
    return <CartEmptyState />
  }

  const productCount = initialItems.length

  return (
    <main className="min-h-screen flex-1 bg-white pb-20 antialiased dark:bg-background">
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <Link
          href="/boards"
          className="inline-flex items-center gap-1 text-[14px] text-neutral-500 transition-colors hover:text-black dark:text-neutral-400 dark:hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Continue shopping
        </Link>

        <header className="mt-6">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground md:text-[32px]">
            Your cart
          </h1>
          <p className="mt-1 text-[15px] text-neutral-500 dark:text-neutral-400">
            {productCount} {productCount === 1 ? "Product" : "Products"} in Your cart
          </p>
          {unavailableCount > 0 ? (
            <p className="mt-2 text-[13px] text-amber-800 dark:text-amber-400">
              {unavailableCount} unavailable {unavailableCount === 1 ? "item is" : "items are"} not included in the
              total.
            </p>
          ) : null}
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-start lg:gap-10">
          <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-6 dark:border-white/10 dark:bg-background">
            <ul className="divide-y divide-neutral-200 dark:divide-white/10">
              {initialItems.map(({ cartCreatedAt, listing, quantity, agreedPriceUsd }) => {
                const img = listingTitleThumbnailSrc(listing.listing_images ?? null)
                const seller = listing.profiles
                const isShop = isReswellShopListing(listing.section)
                const sellerName = isShop ? "Reswell" : getPublicSellerDisplayName(seller)
                const sellerHref = isShop ? "/reswell/shop" : sellerProfileHref(seller)
                const available = listingAvailable(listing)
                const href = listingDetailHref(listing)
                const title = listing.title
                const listPrice = Number(listing.price)
                const hasAcceptedOffer = agreedPriceUsd != null && agreedPriceUsd > 0
                const unitPrice = hasAcceptedOffer ? agreedPriceUsd : listPrice
                const qty = Math.max(1, quantity || 1)
                const lineTotal = unitPrice * qty
                const stockMax = Math.max(1, Math.floor(Number(listing.stock_quantity) || qty))
                const condition = formatCondition(listing.condition)
                const boardType = formatBoardType(listing.board_type)
                const lengthLine = formatListingBoardLengthSubtitle({
                  dimensions: listing.dimensions,
                })
                const favorited = favoritedListingIds.includes(listing.id)

                const attrParts: string[] = []
                if (condition) attrParts.push(`Condition: ${condition}`)
                if (boardType) attrParts.push(`Type: ${boardType}`)
                if (lengthLine) attrParts.push(`Length: ${lengthLine}`)

                return (
                  <li key={`${listing.id}-${cartCreatedAt}`} className="py-5 first:pt-0 last:pb-0 sm:py-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
                      <Link
                        href={href}
                        className="relative mx-auto aspect-square w-full max-w-[120px] shrink-0 overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-neutral-200/80 sm:mx-0 sm:h-[100px] sm:w-[100px] dark:ring-white/10"
                      >
                        {img ? (
                          <Image
                            src={img}
                            alt={title}
                            fill
                            className="object-cover"
                            sizes="120px"
                            unoptimized={listingImageShouldBypassOptimization(img)}
                          />
                        ) : (
                          <div className="flex h-full min-h-[100px] items-center justify-center text-[11px] text-neutral-400">
                            No image
                          </div>
                        )}
                      </Link>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <Link
                            href={href}
                            className="text-[16px] font-semibold leading-snug text-foreground hover:underline"
                          >
                            {title}
                          </Link>
                          <p className="shrink-0 text-right text-[16px] font-semibold tabular-nums text-foreground">
                            {hasAcceptedOffer && listPrice !== unitPrice ? (
                              <span className="mr-2 text-[13px] font-normal text-neutral-400 line-through">
                                ${formatMoney(listPrice)}
                              </span>
                            ) : null}
                            ${formatMoney(lineTotal)}
                          </p>
                        </div>

                        <p className="mt-2 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                          {attrParts.length > 0 ? `${attrParts.join(" · ")} · ` : null}
                          Price: ${formatMoney(unitPrice)} USD / per item
                        </p>
                        {hasAcceptedOffer ? (
                          <p className="mt-1 text-[13px] font-medium text-emerald-700 dark:text-emerald-400">
                            Your accepted price: ${formatMoney(unitPrice)} at checkout
                          </p>
                        ) : null}

                        <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[12px] text-neutral-500 dark:text-neutral-400">
                          <span>Sold by</span>
                          <Link
                            href={sellerHref}
                            className="inline-flex max-w-[200px] items-center gap-1 truncate font-medium text-neutral-800 hover:underline dark:text-neutral-200"
                          >
                            <span className="truncate">{sellerName}</span>
                            {!isShop && seller?.shop_verified ? <VerifiedBadge size="sm" /> : null}
                          </Link>
                        </div>

                        {!available && (
                          <p className="mt-3 text-[13px] text-amber-800 dark:text-amber-400">
                            No longer available — remove this item to continue.
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-2 sm:justify-end">
                          {isShop ? (
                            <div className="flex h-9 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-1 dark:border-white/15 dark:bg-transparent">
                              <button
                                type="button"
                                disabled={pending || qty <= 1}
                                onClick={() => setQty(listing.id, qty - 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="min-w-[1.5rem] text-center text-[15px] tabular-nums text-foreground">
                                {qty}
                              </span>
                              <button
                                type="button"
                                disabled={pending || qty >= stockMax}
                                onClick={() => setQty(listing.id, qty + 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div
                              className="flex h-9 cursor-default items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 dark:border-white/15 dark:bg-transparent"
                              role="img"
                              aria-label="Quantity 1"
                            >
                              <span className="text-[13px] text-neutral-500">Qty:</span>
                              <span className="text-[15px] tabular-nums text-foreground">1</span>
                            </div>
                          )}
                          <CartLineFavoriteButton listingId={listing.id} initialFavorited={favorited} />
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => remove(listing.id)}
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100",
                              "text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-black",
                              "disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/15",
                            )}
                            aria-label="Remove from cart"
                          >
                            <X className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-white/10">
              <button type="button" disabled={pending} onClick={removeAll} className={cn(linkMuted, "disabled:opacity-50")}>
                Remove all from cart
              </button>
            </div>
          </div>

          <aside className="lg:sticky lg:top-6">
            <CartOrderSummary
              itemCount={availableCount}
              subtotal={availableTotal}
              deliveryLabel={deliveryLabel}
              taxLabel="Calculated at checkout"
              checkoutActions={checkoutActions}
              checkoutPending={pending}
              deliveryNote={deliveryNote}
            />
          </aside>
        </div>

        <CartSellerAddonsCarousel
          initialListings={sellerAddonListings}
          subtitle={sellerAddonSubtitle}
          viewAllHref={sellerAddonViewAllHref}
          viewAllLabel={sellerAddonViewAllLabel}
          buyerId={buyerId}
          favoritedListingIds={favoritedListingIds}
        />

        <CartBuyingFaq className="mt-16 border-t border-neutral-200 pt-12 dark:border-white/10" />

        <CartFavoritesCarousel initialListings={favoriteCarouselListings} buyerId={buyerId} />
      </div>
    </main>
  )
}

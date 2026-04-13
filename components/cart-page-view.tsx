"use client"

import { useMemo, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, ChevronLeft, Heart, ShoppingCart, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  clearCart,
  removeCartItem,
  type CartPageItem,
} from "@/app/actions/cart"
import { toggleFavoriteListing } from "@/app/actions/favorites"
import { listingDetailHref, peerListingCheckoutHref } from "@/lib/listing-href"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import { formatBoardType, formatCondition, getPublicSellerDisplayName } from "@/lib/listing-labels"
import { formatListingBoardLengthSubtitle } from "@/lib/listing-dimensions-display"
import { sellerProfileHref } from "@/lib/seller-slug"
import { VerifiedBadge } from "@/components/verified-badge"
import { CartBuyingFaq } from "@/components/features/cart/cart-buying-faq"
import {
  CartFavoritesCarousel,
  type CartCarouselFavoriteListing,
} from "@/components/features/cart/cart-favorites-carousel"
import { CartOrderSummary } from "@/components/features/cart/cart-order-summary"
import { cn } from "@/lib/utils"

function checkoutHrefForListing(listing: CartPageItem["listing"]): string {
  const param = listing.slug?.trim() || listing.id
  return peerListingCheckoutHref(listing.section, param)
}

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
  const [favorited, setFavorited] = useState(initialFavorited)
  const [loading, setLoading] = useState(false)

  async function onClick() {
    setLoading(true)
    try {
      const result = await toggleFavoriteListing(listingId)
      if ("error" in result) {
        toast.error(result.error === "Unauthorized" ? "Please sign in to save favorites" : "Could not update favorites")
        return
      }
      setFavorited(result.favorited)
      toast.success(result.favorited ? "Saved to favorites" : "Removed from favorites")
    } catch {
      toast.error("Could not update favorites")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 transition-colors",
        "hover:bg-neutral-200 disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/15",
        favorited && "text-red-500 hover:text-red-600",
      )}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart className={cn("h-4 w-4", favorited && "fill-current")} strokeWidth={1.75} />
    </button>
  )
}

export function CartPageView({
  initialItems,
  loadError,
  favoritedListingIds,
  favoriteCarouselListings,
  buyerId,
}: {
  initialItems: CartPageItem[]
  loadError: string | null
  favoritedListingIds: string[]
  favoriteCarouselListings: CartCarouselFavoriteListing[]
  buyerId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const {
    availableTotal,
    availableCount,
    unavailableCount,
    firstAvailableItem,
    deliveryLabel,
    deliveryNote,
  } = useMemo(() => {
    let total = 0
    let unavail = 0
    let first: (typeof initialItems)[0] | null = null
    for (const row of initialItems) {
      if (listingAvailable(row.listing)) {
        total += Number(row.listing.price)
        if (!first) first = row
      } else {
        unavail += 1
      }
    }
    const avail = initialItems.length - unavail

    let shipLabel = "Calculated at checkout"
    const availRows = initialItems.filter(({ listing }) => listingAvailable(listing))
    if (availRows.length > 0) {
      const withShip = availRows.filter(({ listing }) => listing.shipping_available)
      if (withShip.length > 0) {
        const rates = withShip.map(({ listing }) => Math.max(0, parseFloat(String(listing.shipping_price ?? 0)) || 0))
        shipLabel = rates.every((r) => r === 0) ? "FREE" : "Calculated at checkout"
      } else if (availRows.some(({ listing }) => listing.local_pickup !== false)) {
        shipLabel = "Pickup only"
      }
    }

    const note =
      availRows.length > 0 && availRows.some(({ listing }) => listing.shipping_available)
        ? "Shipping cost and delivery timing are finalized with the seller at checkout."
        : "Pickup or shipping details are confirmed with the seller when you check out."

    return {
      availableTotal: total,
      availableCount: avail,
      unavailableCount: unavail,
      firstAvailableItem: first,
      deliveryLabel: shipLabel,
      deliveryNote: note,
    }
  }, [initialItems])

  const firstCheckoutHref = firstAvailableItem ? checkoutHrefForListing(firstAvailableItem.listing) : null

  function remove(listingId: string) {
    startTransition(async () => {
      const r = await removeCartItem(listingId)
      if (!r.ok) {
        toast.error(r.error ?? "Could not remove")
        return
      }
      toast.success("Removed from cart")
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
      toast.success("Cart cleared")
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
            <Link href="/boards">Back to surfboards</Link>
          </Button>
        </div>
      </main>
    )
  }

  if (initialItems.length === 0) {
    return (
      <main className="flex-1 bg-white antialiased dark:bg-background">
        <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col justify-center px-6 py-24 text-center sm:px-8">
          <div className="mx-auto mb-10 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100/90 ring-1 ring-black/[0.04] dark:bg-muted dark:ring-white/10">
            <ShoppingCart className="h-6 w-6 text-neutral-400" strokeWidth={1} />
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-neutral-950 dark:text-foreground md:text-[32px]">
            Your cart is empty
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-neutral-600 dark:text-muted-foreground">
            Save listings here while you browse. You can check out when you&apos;re ready.
          </p>
          <Button
            asChild
            className="mx-auto mt-10 h-11 min-w-[11rem] rounded-lg bg-[#3b63e3] px-7 text-[15px] font-medium text-white shadow-sm hover:bg-[#2d54d8]"
            size="lg"
          >
            <Link href="/boards">Continue shopping</Link>
          </Button>
        </div>
      </main>
    )
  }

  const productCount = initialItems.length

  return (
    <main className="min-h-screen flex-1 bg-white pb-20 antialiased dark:bg-background">
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <Link
          href="/boards"
          className="inline-flex items-center gap-1 text-[14px] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Continue shopping
        </Link>

        <header className="mt-6">
          <h1 className="text-[28px] font-semibold tracking-tight text-neutral-950 dark:text-foreground md:text-[32px]">
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
              {initialItems.map(({ cartCreatedAt, listing }) => {
                const img = listingCardImageSrc(listing.listing_images ?? null)
                const seller = listing.profiles
                const sellerName = getPublicSellerDisplayName(seller)
                const sellerHref = sellerProfileHref(seller)
                const available = listingAvailable(listing)
                const href = listingDetailHref(listing)
                const title = listing.title
                const price = Number(listing.price)
                const condition = formatCondition(listing.condition)
                const boardType = formatBoardType(listing.board_type)
                const lengthLine = formatListingBoardLengthSubtitle({
                  length_feet: listing.length_feet,
                  length_inches: listing.length_inches,
                  length_inches_display: listing.length_inches_display,
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
                            className="text-[16px] font-semibold leading-snug text-neutral-950 hover:underline dark:text-foreground"
                          >
                            {title}
                          </Link>
                          <p className="shrink-0 text-[16px] font-semibold tabular-nums text-neutral-950 dark:text-foreground">
                            ${formatMoney(price)}
                          </p>
                        </div>

                        <p className="mt-2 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                          {attrParts.length > 0 ? `${attrParts.join(" · ")} · ` : null}
                          Price: ${formatMoney(price)} USD / per item
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[12px] text-neutral-500 dark:text-neutral-400">
                          <span>Sold by</span>
                          <Link
                            href={sellerHref}
                            className="inline-flex max-w-[200px] items-center gap-1 truncate font-medium text-neutral-800 hover:underline dark:text-neutral-200"
                          >
                            <span className="truncate">{sellerName}</span>
                            {seller?.shop_verified ? <VerifiedBadge size="sm" /> : null}
                          </Link>
                        </div>

                        {!available && (
                          <p className="mt-3 text-[13px] text-amber-800 dark:text-amber-400">
                            No longer available — remove this item to continue.
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-2 sm:justify-end">
                          <div
                            className="flex h-9 cursor-default items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 dark:border-white/15 dark:bg-transparent"
                            role="img"
                            aria-label="Quantity 1"
                          >
                            <span className="text-[13px] text-neutral-500">Qty:</span>
                            <span className="text-[15px] tabular-nums text-neutral-950 dark:text-foreground">1</span>
                            <ChevronDown className="h-4 w-4 text-neutral-500" strokeWidth={2} aria-hidden />
                          </div>
                          <CartLineFavoriteButton listingId={listing.id} initialFavorited={favorited} />
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => remove(listing.id)}
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100",
                              "text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-neutral-950",
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
              discountAmount={0}
              total={availableTotal}
              firstCheckoutHref={firstCheckoutHref}
              checkoutPending={pending}
              deliveryNote={deliveryNote}
            />
          </aside>
        </div>

        <CartBuyingFaq className="mt-16 border-t border-neutral-200 pt-12 dark:border-white/10" />

        <CartFavoritesCarousel initialListings={favoriteCarouselListings} buyerId={buyerId} />
      </div>
    </main>
  )
}

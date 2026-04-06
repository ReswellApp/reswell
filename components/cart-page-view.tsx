"use client"

import { useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, ShoppingCart, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { removeCartItem, type CartPageItem } from "@/app/actions/cart"
import { listingDetailHref, peerListingCheckoutHref } from "@/lib/listing-href"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import { getPublicSellerDisplayName } from "@/lib/listing-labels"
import { sellerProfileHref } from "@/lib/seller-slug"
import { VerifiedBadge } from "@/components/verified-badge"

function checkoutHrefForListing(listing: CartPageItem["listing"]): string {
  const param = listing.slug?.trim() || listing.id
  return peerListingCheckoutHref(listing.section, param)
}

export function CartPageView({
  initialItems,
  loadError,
}: {
  initialItems: CartPageItem[]
  loadError: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

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

  if (loadError) {
    return (
      <main className="flex-1 py-8">
        <div className="container mx-auto max-w-3xl px-4">
          <p className="text-destructive">{loadError}</p>
        </div>
      </main>
    )
  }

  if (initialItems.length === 0) {
    return (
      <main className="flex-1 py-8">
        <div className="container mx-auto max-w-2xl px-4 text-center py-16">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-8">
            Save listings from surfboards and used gear while you browse, then check out when you are ready.
          </p>
          <Button asChild>
            <Link href="/boards">Browse surfboards</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 py-8">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="sm" className="-ml-2 gap-2" asChild>
            <Link href="/boards">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Cart</h1>
          <span className="text-sm text-muted-foreground">
            {initialItems.length} saved {initialItems.length === 1 ? "item" : "items"}
          </span>
        </div>

        <ul className="space-y-4">
          {initialItems.map(({ cartCreatedAt, listing }) => {
            const img = listingCardImageSrc(listing.listing_images ?? null)
            const seller = listing.profiles
            const sellerName = getPublicSellerDisplayName(seller)
            const sellerHref = sellerProfileHref(seller)
            const available =
              listing.status === "active" || listing.status === "pending_sale"
            const href = listingDetailHref(listing)
            const buyHref = checkoutHrefForListing(listing)

            return (
              <li key={`${listing.id}-${cartCreatedAt}`}>
                <Card className="overflow-hidden border-border/80 shadow-sm">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
                      <Link
                        href={href}
                        className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:h-32 sm:w-32"
                      >
                        {img ? (
                          <Image
                            src={img}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width:640px) 100vw, 128px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            No image
                          </div>
                        )}
                      </Link>

                      <div className="min-w-0 flex-1 flex flex-col gap-3">
                        <div>
                          <Link
                            href={href}
                            className="font-semibold text-foreground hover:text-primary line-clamp-2"
                          >
                            {listing.title}
                          </Link>
                          <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                            ${Number(listing.price).toFixed(2)}
                          </p>
                          {!available && (
                            <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                              No longer available — remove to clear your cart.
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-9 w-9 shrink-0 border border-border">
                            {seller?.avatar_url ? (
                              <AvatarImage src={seller.avatar_url} alt="" />
                            ) : null}
                            <AvatarFallback className="text-xs">
                              {sellerName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-muted-foreground">Seller</p>
                            <Link
                              href={sellerHref}
                              className="text-sm font-medium text-foreground hover:text-primary truncate inline-flex items-center gap-1 max-w-full"
                            >
                              <span className="truncate">{sellerName}</span>
                              {seller?.shop_verified ? <VerifiedBadge size="sm" /> : null}
                            </Link>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
                          {available ? (
                            <Button size="sm" disabled={pending} asChild>
                              <Link href={buyHref}>Buy</Link>
                            </Button>
                          ) : (
                            <Button size="sm" variant="secondary" disabled>
                              Buy
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => remove(listing.id)}
                            className="gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}

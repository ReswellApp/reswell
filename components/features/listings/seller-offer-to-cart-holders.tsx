"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Loader2, ShoppingCart, Tag } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SellerMakeOfferToBuyerDialog } from "@/components/features/messages/seller-make-offer-to-buyer-dialog"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { offerMessagesHref } from "@/lib/utils/offer-messages-href"
import { cn } from "@/lib/utils"
import type { ListingCartHolder } from "@/lib/types/listing-cart-holders"

function holderInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "M"
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase()
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase()
}

function addedAgo(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "In cart"
  return `Added ${formatDistanceToNow(date, { addSuffix: true })}`
}

export type SellerOfferToCartHoldersProps = {
  listingId: string
  sellerUserId: string
  cartHolderCount: number
  listingTitle?: string
  listPrice?: number
  primaryImageUrl?: string | null
  triggerClassName?: string
  triggerSize?: "sm" | "default"
  triggerLabel?: string
  triggerVariant?: "button" | "stat"
}

export function SellerOfferToCartHolders({
  listingId,
  sellerUserId,
  cartHolderCount,
  listingTitle,
  listPrice,
  primaryImageUrl,
  triggerClassName,
  triggerSize = "default",
  triggerLabel,
  triggerVariant = "button",
}: SellerOfferToCartHoldersProps) {
  const [listOpen, setListOpen] = useState(false)
  const [holders, setHolders] = useState<ListingCartHolder[]>([])
  const [loading, setLoading] = useState(false)
  const [offerBuyerId, setOfferBuyerId] = useState<string | null>(null)

  const loadHolders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/listings/${listingId}/cart-holders`, {
        method: "GET",
        credentials: "include",
      })
      const json: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err =
          typeof json === "object" &&
          json !== null &&
          "error" in json &&
          typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : "Could not load buyers in cart."
        toast.error(err)
        setHolders([])
        return
      }
      const data =
        typeof json === "object" && json !== null && "data" in json
          ? (json as { data?: { holders?: ListingCartHolder[] } }).data
          : undefined
      setHolders(Array.isArray(data?.holders) ? data.holders : [])
    } finally {
      setLoading(false)
    }
  }, [listingId])

  function openList() {
    setListOpen(true)
    void loadHolders()
  }

  function handleMakeOffer(buyerUserId: string) {
    setOfferBuyerId(buyerUserId)
  }

  function handleDialogOpenChange(open: boolean) {
    setListOpen(open)
    if (!open) setOfferBuyerId(null)
  }

  const buttonLabel =
    triggerLabel ??
    (cartHolderCount === 1 ? "Offer to buyer in cart" : `Offer to ${cartHolderCount} in cart`)
  const statLabel =
    cartHolderCount === 1 ? "In someone’s cart" : `In ${cartHolderCount} buyers’ carts`

  return (
    <>
      {triggerVariant === "stat" ? (
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 font-medium text-foreground/80 transition-colors hover:text-foreground",
            triggerClassName,
          )}
          aria-haspopup="dialog"
          aria-label={`${statLabel}. Make an offer`}
          onClick={openList}
        >
          <ShoppingCart className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          <span>{statLabel}</span>
          <span className="text-listingHeart underline decoration-listingHeart/50 underline-offset-2">
            Offer
          </span>
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size={triggerSize}
          className={cn("rounded-full", triggerClassName)}
          aria-haspopup="dialog"
          aria-label={buttonLabel}
          onClick={openList}
        >
          <Tag className="h-3.5 w-3.5" aria-hidden />
          {buttonLabel}
        </Button>
      )}

      <Dialog open={listOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          showCloseButton
          className={cn(
            "flex max-h-[min(92vh,720px)] w-[calc(100%-1.5rem)] flex-col overflow-hidden p-0",
            offerBuyerId ? "max-w-lg" : "max-w-md",
          )}
        >
          {offerBuyerId ? (
            <SellerMakeOfferToBuyerDialog
              embedded
              open
              onOpenChange={(open) => {
                if (!open) {
                  setOfferBuyerId(null)
                  setListOpen(false)
                }
              }}
              listingId={listingId}
              buyerUserId={offerBuyerId}
              sellerUserId={sellerUserId}
              listingTitle={listingTitle}
              listPrice={listPrice}
              primaryImageUrl={primaryImageUrl}
            />
          ) : (
            <>
              <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 sm:px-6">
                <DialogTitle className="text-left text-xl font-semibold">
                  Buyers with this in their cart
                </DialogTitle>
                <DialogDescription className="text-left text-[15px] leading-snug text-muted-foreground">
                  Send a private offer. Only you can see who has this listing saved.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                {loading ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading buyers…
                  </div>
                ) : holders.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground" aria-hidden />
                    <p className="text-sm text-muted-foreground">
                      No one has this listing in their cart right now.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {holders.map((holder) => {
                      const avatarSrc = profileMediaDisplaySrc(holder.avatarUrl)
                      const hasOpenOffer = Boolean(holder.openOfferId)
                      return (
                        <li
                          key={holder.buyerUserId}
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5"
                        >
                          <Avatar className="h-10 w-10 shrink-0">
                            {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
                            <AvatarFallback>{holderInitials(holder.displayName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {holder.displayName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {hasOpenOffer ? "Offer pending" : addedAgo(holder.addedAt)}
                            </p>
                          </div>
                          {hasOpenOffer ? (
                            <Button asChild size="sm" variant="outline" className="shrink-0 rounded-full">
                              <Link
                                href={offerMessagesHref(
                                  {
                                    listing_id: listingId,
                                    buyer_id: holder.buyerUserId,
                                    seller_id: sellerUserId,
                                  },
                                  "seller",
                                  holder.conversationId,
                                )}
                              >
                                View offer
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              className="shrink-0 rounded-full"
                              onClick={() => handleMakeOffer(holder.buyerUserId)}
                            >
                              Make offer
                            </Button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

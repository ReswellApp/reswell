"use client"

import Image from "next/image"
import Link from "next/link"
import { ImageOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import {
  addedToCartHeading,
  formatAddedToCartMoney,
  type AddedToCartPreview,
} from "@/lib/utils/added-to-cart"
import { cn } from "@/lib/utils"

const checkoutCta =
  "h-11 w-full rounded-lg border-0 bg-[#5574AD] text-[14px] font-semibold text-white shadow-none hover:bg-[#466091] hover:text-white"

const continueCta =
  "h-11 w-full rounded-lg border-0 bg-foreground text-[14px] font-semibold text-background shadow-none hover:bg-foreground/90"

type AddedToCartDialogProps = {
  preview: AddedToCartPreview | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddedToCartDialog({ preview, open, onOpenChange }: AddedToCartDialogProps) {
  const heading = addedToCartHeading(preview?.addedQuantity ?? 1)
  const unitPrice = preview?.priceUsd
  const lineTotal =
    unitPrice != null && Number.isFinite(unitPrice)
      ? unitPrice * Math.max(1, preview?.lineQuantity ?? 1)
      : null
  const qty = Math.max(1, preview?.lineQuantity ?? 1)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "flex w-[calc(100%-1rem)] max-h-[min(92dvh,44rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl md:max-w-4xl",
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b border-border/70 px-4 py-4 pr-12 text-center sm:px-6">
          <DialogTitle className="text-[15px] font-semibold leading-snug tracking-tight sm:text-base">
            {heading}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose checkout, continue shopping, or review your cart.
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(14rem,16rem)] sm:items-start sm:gap-6 sm:p-6">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-[16rem] overflow-hidden rounded-lg bg-neutral-100 sm:mx-0 sm:max-w-none dark:bg-neutral-900">
              {preview.imageUrl ? (
                <Image
                  src={preview.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 639px) 70vw, 280px"
                  className="object-contain"
                  unoptimized={listingImageShouldBypassOptimization(preview.imageUrl)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageOff className="h-8 w-8" aria-hidden />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-snug tracking-tight text-foreground">
                {preview.title}
              </h3>
              {unitPrice != null ? (
                <p className="mt-4 text-[15px] tabular-nums text-foreground">
                  {qty} × ${formatAddedToCartMoney(unitPrice)}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:pt-0">
              <Button asChild className={checkoutCta}>
                <Link href={preview.checkoutHref} prefetch onClick={() => onOpenChange(false)}>
                  Proceed to checkout
                </Link>
              </Button>
              <Button type="button" className={continueCta} onClick={() => onOpenChange(false)}>
                Continue shopping
              </Button>
              {lineTotal != null ? (
                <div className="mt-3 space-y-1 text-center">
                  <p className="text-sm text-muted-foreground">Order subtotal</p>
                  <p className="text-lg font-semibold tabular-nums text-foreground">
                    ${formatAddedToCartMoney(lineTotal)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your cart contains {preview.cartCount}{" "}
                    {preview.cartCount === 1 ? "item" : "items"}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  Your cart contains {preview.cartCount}{" "}
                  {preview.cartCount === 1 ? "item" : "items"}
                </p>
              )}
              <Button asChild variant="outline" className="mt-1 h-11 w-full rounded-lg text-[14px] font-medium">
                <Link href="/cart" onClick={() => onOpenChange(false)}>
                  View or edit your cart
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

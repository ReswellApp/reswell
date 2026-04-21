import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { ImageOff, ShoppingBag } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { sellerProfileHref } from "@/lib/seller-slug"
import { cn } from "@/lib/utils"
import type { CheckoutListing, CheckoutSeller } from "@/components/checkout-types"

function sellerDisplayName(s: CheckoutSeller) {
  if (s.is_shop && s.shop_name?.trim()) return s.shop_name.trim()
  return s.display_name?.trim() || "Seller"
}

export function CheckoutOrderSummaryAside({
  listing,
  seller,
  imageUrl,
  needsShipping,
  displayTotals,
  shippingSummaryRight,
}: {
  listing: CheckoutListing
  seller?: CheckoutSeller | null
  imageUrl: string | null
  needsShipping: boolean
  displayTotals: { itemPrice: number; shipping: number; total: number }
  shippingSummaryRight: ReactNode
}) {
  const backHref = listingDetailHref(listing)

  return (
    <aside
      className={cn(
        "order-1 border-b border-neutral-200 bg-[#F5F5F5] px-4 py-8 sm:px-8 lg:order-2 lg:w-[min(420px,42%)] lg:shrink-0 lg:border-b-0 lg:border-l lg:border-neutral-200 lg:px-8 lg:py-10",
        "lg:min-h-[calc(100dvh-3.5rem)]",
      )}
    >
      <div className="mx-auto max-w-[400px] lg:sticky lg:top-24 lg:mx-0">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-[13px] font-medium uppercase tracking-wide text-neutral-500">Order summary</span>
          <Link
            href="/cart"
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#3b63e3] hover:underline"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden />
            Cart
          </Link>
        </div>

        <div className="flex gap-4">
          <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[8px] border border-neutral-200/80 bg-white shadow-sm">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={capitalizeWords(listing.title)}
                fill
                className="object-cover"
                sizes="72px"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-neutral-100">
                <ImageOff className="h-7 w-7 text-neutral-300" aria-hidden />
              </div>
            )}
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1 text-[11px] font-semibold text-white shadow-sm">
              1
            </span>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <Link
              href={backHref}
              className="text-[15px] font-semibold leading-snug text-foreground underline-offset-2 hover:underline"
            >
              {capitalizeWords(listing.title)}
            </Link>
            <p className="mt-1 text-[13px] text-neutral-500">
              Qty 1 · {needsShipping ? "Shipping" : "Local pickup"}
            </p>
            {seller && (
              <p className="mt-2 text-[12px] text-neutral-500">
                Sold by{" "}
                <Link href={sellerProfileHref(seller)} className="font-medium text-[#3b63e3] hover:underline">
                  {sellerDisplayName(seller)}
                </Link>
              </p>
            )}
          </div>
          <p className="shrink-0 pt-0.5 text-[15px] font-semibold tabular-nums text-foreground">
            ${displayTotals.itemPrice.toFixed(2)}
          </p>
        </div>

        <div className="mt-6">
          <div className="flex gap-2">
            <div
              className="flex h-11 min-w-0 flex-1 items-center rounded-[6px] border border-neutral-200 bg-white px-3 text-[13px] text-neutral-400"
              role="status"
            >
              Discount code or gift card
            </div>
            <div
              className="flex h-11 shrink-0 items-center rounded-[6px] border border-neutral-200 bg-neutral-200/70 px-4 text-[13px] font-medium text-neutral-400"
              aria-hidden
            >
              Apply
            </div>
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">Promo codes are not available for peer listings yet.</p>
        </div>

        <div className="mt-8 space-y-2.5 border-t border-neutral-200/90 pt-6 text-[14px]">
          <div className="flex justify-between gap-4">
            <span className="text-neutral-600">Subtotal</span>
            <span className="tabular-nums font-medium text-foreground">${displayTotals.itemPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-neutral-600">Shipping</span>
            <div className="text-right text-[14px]">{shippingSummaryRight}</div>
          </div>
          <div className="flex justify-between gap-4 border-t border-neutral-200/90 pt-4 text-[16px] font-semibold">
            <span className="text-foreground">Total</span>
            <p className="tabular-nums text-foreground">
              <span className="text-[13px] font-normal text-neutral-500">USD </span>
              ${displayTotals.total.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}

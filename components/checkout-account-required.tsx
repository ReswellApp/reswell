"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { GoogleOAuthButton } from "@/components/auth/google-oauth-button"
import { CheckoutOrderSummaryAside } from "@/components/checkout-order-summary-aside"
import type { CheckoutListing, CheckoutSeller } from "@/components/checkout-types"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
function primaryListingImageUrl(images: CheckoutListing["listing_images"]): string | null {
  if (!images?.length) return null
  const primary = images.find((i) => i.is_primary)
  const raw = (primary ?? images[0]).url
  return proxiedListingImageSrc(raw) || null
}

export function CheckoutAccountRequired({
  listing,
  seller,
  checkoutReturnPath,
  previewTotals,
  shippingSummaryRight,
  needsShipping,
}: {
  listing: CheckoutListing
  seller: CheckoutSeller | null
  /** Path only (e.g. `/checkout?listing=…`) for auth redirects. */
  checkoutReturnPath: string
  previewTotals: { itemPrice: number; shipping: number; total: number }
  shippingSummaryRight: ReactNode
  needsShipping: boolean
}) {
  const imageUrl = primaryListingImageUrl(listing.listing_images)
  const redirectParam = encodeURIComponent(checkoutReturnPath)

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:min-h-[calc(100dvh-4rem)]">
      <div className="flex w-full flex-1 flex-col lg:flex-row">
        <div className="order-2 flex-1 bg-white px-4 py-8 sm:px-8 lg:order-1 lg:max-w-[640px] lg:shrink-0 lg:px-10 lg:py-10 xl:px-14">
          <div className="mx-auto max-w-[520px] lg:mx-0">
            <div className="mb-10 space-y-6">
              <div className="space-y-2">
                <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Account required</h2>
                <p className="text-[14px] leading-relaxed text-neutral-600">
                  Create a free Reswell account to complete your purchase. You can review this order on the right while
                  you sign in or sign up.
                </p>
              </div>
              <GoogleOAuthButton nextPath={checkoutReturnPath} className="w-full" />
              <div className="relative flex items-center justify-center py-1">
                <div className="absolute inset-x-0 top-1/2 h-px bg-neutral-200" aria-hidden />
                <span className="relative bg-white px-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  or
                </span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href={`/auth/sign-up?redirect=${redirectParam}`}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-[6px] bg-[#3b63e3] px-5 text-[15px] font-semibold text-white shadow-none transition-colors hover:bg-[#2d54d8]"
                >
                  Create account
                </Link>
                <Link
                  href={`/auth/login?redirect=${redirectParam}`}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-[6px] border border-neutral-300 bg-white px-5 text-[15px] font-semibold text-neutral-800 shadow-none transition-colors hover:bg-neutral-50"
                >
                  Log in
                </Link>
              </div>
              <p className="text-[12px] leading-relaxed text-neutral-500">
                We need an account to process payment securely, send receipts, and protect your purchase.
              </p>
            </div>
          </div>
        </div>

        <CheckoutOrderSummaryAside
          listing={listing}
          seller={seller}
          imageUrl={imageUrl}
          needsShipping={needsShipping}
          displayTotals={previewTotals}
          shippingSummaryRight={shippingSummaryRight}
        />
      </div>
    </div>
  )
}

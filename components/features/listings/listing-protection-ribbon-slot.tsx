"use client"

import { ListingProtectionTrustRibbon } from "@/components/features/listings/listing-protection-trust-ribbon"
import { useListingViewer } from "@/components/features/listings/listing-viewer-provider"
import { listingViewerIsOwner } from "@/lib/listing-owner-view"

const BUYER_RIBBON_CLASS =
  "mt-5 hidden border-b border-neutral-200/90 pb-5 dark:border-neutral-700/70 lg:block"
const SELLER_RIBBON_CLASS =
  "mt-5 border-b border-neutral-200/90 pb-5 dark:border-neutral-700/70"

/**
 * Buyer protection copy is what the cached HTML contains.
 * The seller variant renders only after this browser's session matches the seller.
 */
export function ListingProtectionRibbonSlot({
  placement = "buy-column",
}: {
  /** `about` sits under the seller card. `buy-column` is the purchase rail. */
  placement?: "buy-column" | "about"
}) {
  const viewer = useListingViewer()
  const isOwner = listingViewerIsOwner(viewer?.userId, viewer?.sellerUserId)
  const className =
    placement === "about" ? "mt-5" : isOwner ? SELLER_RIBBON_CLASS : BUYER_RIBBON_CLASS
  if (isOwner) {
    return <ListingProtectionTrustRibbon viewerRole="seller" className={className} />
  }
  return <ListingProtectionTrustRibbon viewerRole="buyer" className={className} />
}

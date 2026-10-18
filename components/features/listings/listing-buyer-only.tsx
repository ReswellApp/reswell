"use client"

import type { ReactNode } from "react"
import { useListingViewer } from "@/components/features/listings/listing-viewer-provider"
import { listingViewerIsOwner } from "@/lib/listing-owner-view"

/** Buyer markup from the cached listing document. Hidden once this browser is the seller. */
export function ListingBuyerOnly({ children }: { children: ReactNode }) {
  const viewer = useListingViewer()
  const isOwner = listingViewerIsOwner(viewer?.userId, viewer?.sellerUserId)
  if (isOwner) return null
  return children
}

"use client"

import Link from "next/link"
import {
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Store,
  Undo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { listingDetailHref } from "@/lib/listing-href"
import type { ShopifyLinkedListing } from "@/lib/shopify/types"

interface ShopifyLinkedListingActionsProps {
  listing: ShopifyLinkedListing
  busy: boolean
  canSync: boolean
  onResync: (productId: string) => void
  onUnpublish: (productId: string) => void
}

export function ShopifyLinkedListingActions({
  listing,
  busy,
  canSync,
  onResync,
  onUnpublish,
}: ShopifyLinkedListingActionsProps) {
  const linked = listing.selected
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={busy}
          aria-label={`Actions for ${listing.title}`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {linked && canSync ? (
          <DropdownMenuItem onSelect={() => onResync(listing.productId)}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Resync from Shopify
          </DropdownMenuItem>
        ) : null}
        {listing.reswellStatus === "active" ? (
          <DropdownMenuItem asChild>
            <Link href={listingDetailHref({ id: listing.listingId, slug: listing.slug })}>
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              View on Reswell
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/listings/${listing.listingId}/edit`}>
            <Pencil className="mr-2 h-4 w-4" aria-hidden />
            Edit shipping and details
          </Link>
        </DropdownMenuItem>
        {listing.state !== "deleted_in_shopify" ? (
          <DropdownMenuItem asChild>
            <a href={listing.adminUrl} target="_blank" rel="noopener noreferrer">
              <Store className="mr-2 h-4 w-4" aria-hidden />
              Open in Shopify admin
            </a>
          </DropdownMenuItem>
        ) : null}
        {linked && canSync ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onUnpublish(listing.productId)}
            >
              <Undo2 className="mr-2 h-4 w-4" aria-hidden />
              Unpublish product
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

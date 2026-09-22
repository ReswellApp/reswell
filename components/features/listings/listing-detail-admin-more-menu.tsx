"use client"

import Link from "next/link"
import { Flag, Instagram, MoreHorizontal, RotateCcw, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { listingAdminBarCanLinkCatalog, type ListingAdminBarSnapshot } from "@/lib/listing-detail-admin-bar"
import { cn } from "@/lib/utils"

export function ListingDetailAdminMoreMenu({
  listing,
  busy,
  actionClass,
  onPublishDraft,
  onSetStatus,
  onLinkCatalog,
  onToggleGoodDeal,
  onToggleHomepage,
  onToggleBoards,
}: {
  listing: ListingAdminBarSnapshot
  busy: boolean
  actionClass: string
  onPublishDraft: () => void
  onSetStatus: (status: "removed" | "active") => void
  onLinkCatalog: () => void
  onToggleGoodDeal: () => void
  onToggleHomepage: () => void
  onToggleBoards: () => void
}) {
  const canLink = listingAdminBarCanLinkCatalog(listing.section)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className={cn(actionClass, "px-2")}>
          <MoreHorizontal />
          <span className="sr-only">More admin actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {listing.status === "draft" ? (
          <DropdownMenuItem disabled={busy} onClick={onPublishDraft}>
            Publish this draft
          </DropdownMenuItem>
        ) : null}
        {listing.status === "active" ? (
          <DropdownMenuItem disabled={busy} onClick={() => onSetStatus("removed")}>
            <Flag />
            Take it down
          </DropdownMenuItem>
        ) : null}
        {listing.status === "removed" || listing.status === "delinquent" || listing.status === "sold" ? (
          <DropdownMenuItem
            disabled={busy}
            onClick={() => {
              if (listing.status === "sold" && !confirm("Make this sold listing live again?")) return
              onSetStatus("active")
            }}
          >
            <RotateCcw />
            Put it back up
          </DropdownMenuItem>
        ) : null}
        {canLink ? (
          <DropdownMenuItem onClick={onLinkCatalog}>
            <Tag />
            Link a brand or model
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={busy} onClick={onToggleGoodDeal}>
          {listing.isGoodDeal ? "Take off good deal" : "Mark as a good deal"}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onClick={onToggleHomepage}>
          {listing.hiddenFromHomepage ? "Show on the homepage" : "Hide from the homepage"}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onClick={onToggleBoards}>
          {listing.suppressedOnBoardsBrowse ? "Show normally on /boards" : "Sort last on /boards"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/admin/hayden-shop?listingId=${listing.id}`}>
            <Instagram />
            Build Instagram post
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/admin/users/${listing.userId}`}>Seller's page</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/listings">All listings</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

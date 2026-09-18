"use client"

import * as React from "react"
import { BookOpen, Eye, EyeOff, Layers2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ListingDetailAdminCatalogDialogs } from "@/components/features/listings/listing-detail-admin-catalog-dialogs"
import { ListingDetailAdminMoreMenu } from "@/components/features/listings/listing-detail-admin-more-menu"
import { ListingDetailAdminRelatedBlogDialog } from "@/components/features/listings/listing-detail-admin-related-blog-dialog"
import { ListingDetailAdminSearchTags } from "@/components/features/listings/listing-detail-admin-search-tags"
import { useListingDetailAdminBar } from "@/components/features/listings/hooks/use-listing-detail-admin-bar"
import type { ListingAdminBarSnapshot } from "@/lib/listing-detail-admin-bar"
import { cn } from "@/lib/utils"

const actionClass =
  "h-8 rounded-full border border-sky-200/80 bg-white px-3 text-xs font-medium text-sky-950 shadow-sm hover:bg-sky-100 hover:text-sky-950 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900 dark:hover:text-sky-50"

function listingAdminBarStatusLabel(listing: ListingAdminBarSnapshot): string {
  const status =
    listing.status === "active"
      ? "Live"
      : listing.status === "pending_sale"
        ? "Pending sale"
        : listing.status.replaceAll("_", " ")
  const bits = [status]
  if (listing.hiddenFromSite) bits.push("hidden from shoppers")
  if (listing.searchTags.includes("fish")) bits.push("tagged fish")
  else if (listing.searchTags[0]) bits.push(`tagged ${listing.searchTags[0]}`)
  if (listing.sellerDisplayName) bits.push(listing.sellerDisplayName)
  return bits.join(" · ")
}

export function ListingDetailAdminBar({ listing }: { listing: ListingAdminBarSnapshot }) {
  const actions = useListingDetailAdminBar(listing)
  const [brandOpen, setBrandOpen] = React.useState(false)
  const [modelOpen, setModelOpen] = React.useState(false)
  const [linkOpen, setLinkOpen] = React.useState(false)
  const [blogOpen, setBlogOpen] = React.useState(false)
  const busy = actions.busy !== null

  return (
    <div
      className="sticky top-[var(--site-header-height,4rem)] z-40 border-b border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
      data-listing-admin-bar
      role="region"
      aria-label="Listing admin tools"
    >
      <div className="container mx-auto flex min-h-11 items-center gap-2 overflow-x-auto px-4 py-1.5 sm:px-6">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800 dark:bg-sky-900/70 dark:text-sky-100">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Admin tools
        </span>
        <span className="hidden truncate text-xs text-sky-800/80 dark:text-sky-200/80 sm:inline">
          {listingAdminBarStatusLabel(listing)}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={actionClass}
            disabled={busy}
            onClick={actions.editListing}
          >
            <Pencil />
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={actionClass}
            disabled={busy}
            onClick={() => actions.setHiddenFromSite(!listing.hiddenFromSite)}
          >
            {listing.hiddenFromSite ? <Eye /> : <EyeOff />}
            {listing.hiddenFromSite ? "Show" : "Hide"}
          </Button>
          <Button type="button" size="sm" variant="ghost" className={actionClass} onClick={() => setBrandOpen(true)}>
            <Plus />
            Brand
          </Button>
          <Button type="button" size="sm" variant="ghost" className={actionClass} onClick={() => setModelOpen(true)}>
            <Layers2 />
            Model
          </Button>
          <Button type="button" size="sm" variant="ghost" className={actionClass} onClick={() => setBlogOpen(true)}>
            <BookOpen />
            Blog
          </Button>
          <ListingDetailAdminSearchTags listing={listing} actionClass={actionClass} />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              actionClass,
              "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50 dark:hover:text-red-200",
            )}
            disabled={busy}
            onClick={actions.deleteListing}
          >
            <Trash2 />
            Delete
          </Button>
          <ListingDetailAdminMoreMenu
            listing={listing}
            busy={busy}
            actionClass={actionClass}
            onPublishDraft={actions.publishDraft}
            onSetStatus={actions.setStatus}
            onLinkCatalog={() => setLinkOpen(true)}
            onToggleGoodDeal={() => actions.setGoodDeal(!listing.isGoodDeal)}
            onToggleHomepage={() => actions.setHiddenFromHomepage(!listing.hiddenFromHomepage)}
            onToggleBoards={() => actions.setBoardsSuppressed(!listing.suppressedOnBoardsBrowse)}
          />
        </div>
      </div>
      <ListingDetailAdminCatalogDialogs
        listing={listing}
        brandOpen={brandOpen}
        onBrandOpenChange={setBrandOpen}
        modelOpen={modelOpen}
        onModelOpenChange={setModelOpen}
        linkOpen={linkOpen}
        onLinkOpenChange={setLinkOpen}
      />
      <ListingDetailAdminRelatedBlogDialog listing={listing} open={blogOpen} onOpenChange={setBlogOpen} />
    </div>
  )
}

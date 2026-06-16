"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { listingDetailHref } from "@/lib/listing-href"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Plus, MoreVertical, Eye, Edit, Trash2, Package, Archive } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingProductCardSolidClassName } from "@/lib/listing-card-styles"
import { EndListingDialog } from "@/components/end-listing-dialog"
import type { MyListingRow } from "@/lib/db/my-listings"

interface MyListingsClientProps {
  listings: MyListingRow[]
  fetchError?: string
}

function listingCardImageSrc(listing: MyListingRow): string | null {
  const src = listingTitleThumbnailSrc(listing.listing_images ?? null)
  return src || null
}

export function MyListingsClient({ listings, fetchError }: MyListingsClientProps) {
  const router = useRouter()
  const [endListingId, setEndListingId] = useState<string | null>(null)

  async function handleDiscardDraft(id: string) {
    const res = await fetch(`/api/listings/discard-draft?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    })
    if (!res.ok) {
      toast.error("Could not discard draft")
      return
    }
    router.refresh()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
      case "sold":
        return "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
      case "pending":
        return "bg-neutral-50 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
      case "draft":
        return "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getSectionLabel = (section: string) => {
    switch (section) {
      case "used":
        return "Surfboards"
      case "new":
        return "Shop (new)"
      case "surfboards":
        return "Surfboards"
      default:
        return section
    }
  }

  const getListingHref = (section: string, id: string, slug?: string | null) =>
    listingDetailHref({ id, slug, section })

  const filterByStatus = (status: string) => {
    if (status === "all") return listings
    return listings.filter((l) => l.status === status)
  }

  const ListingCard = ({ listing }: { listing: MyListingRow }) => {
    const imageSrc = listingCardImageSrc(listing)
    const isDraft = listing.status === "draft"
    const cardHref = isDraft ? `/sell?edit=${listing.id}` : getListingHref(listing.section, listing.id, listing.slug)

    return (
      <Card className={listingProductCardSolidClassName}>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Link href={cardHref} className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {imageSrc ? (
                <Image
                  src={imageSrc}
                  alt={capitalizeWords(listing.title)}
                  fill
                  className="object-cover object-center"
                  sizes="96px"
                  unoptimized={listingImageShouldBypassOptimization(imageSrc)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={cardHref} className="font-semibold text-foreground hover:text-primary truncate block">
                    {capitalizeWords(listing.title)}
                  </Link>
                  <p className="text-lg font-bold text-black dark:text-white">
                    {isDraft ? (
                      <span className="text-muted-foreground font-normal text-base">Draft</span>
                    ) : (
                      `$${listing.price}`
                    )}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Listing actions">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[12rem] p-1.5">
                    {isDraft ? (
                      <>
                        <DropdownMenuItem asChild className="py-2.5">
                          <Link href={`/sell?edit=${listing.id}`} className="cursor-default">
                            <Edit className="h-4 w-4" />
                            Continue editing
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="py-2.5 text-destructive focus:text-destructive"
                          onClick={() => void handleDiscardDraft(listing.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Discard draft
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem asChild className="py-2.5">
                          <Link
                            href={getListingHref(listing.section, listing.id, listing.slug)}
                            className="cursor-default"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="py-2.5">
                          <Link href={`/sell?edit=${listing.id}`} className="cursor-default">
                            <Edit className="h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        {!isDraft && listing.status !== "sold" ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="py-2.5"
                              onClick={() => setEndListingId(listing.id)}
                            >
                              <Archive className="h-4 w-4" />
                              End listing
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="secondary" className={getStatusColor(listing.status)}>
                  {isDraft ? "Draft" : listing.status}
                </Badge>
                <Badge variant="outline">{getSectionLabel(listing.section)}</Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {listing.views} views
                </span>
                <span>{formatDistanceToNow(new Date(listing.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Listings</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/listings/archived">
            <Button variant="outline">
              <Archive className="h-4 w-4 mr-2" /> Archived
            </Button>
          </Link>
          <Link href="/sell?new=1">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New Listing
            </Button>
          </Link>
        </div>
      </div>

      {fetchError && (
        <p className="mb-4 text-sm text-destructive">Could not load listings. Please refresh the page.</p>
      )}

      {!fetchError && listings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No listings yet</h3>
            <p className="text-muted-foreground mb-4">Start selling by creating your first listing</p>
            <Link href="/sell?new=1">
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Create Listing
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="all">All ({listings.length})</TabsTrigger>
            <TabsTrigger value="draft">Drafts ({filterByStatus("draft").length})</TabsTrigger>
            <TabsTrigger value="active">Active ({filterByStatus("active").length})</TabsTrigger>
            <TabsTrigger value="sold">Sold ({filterByStatus("sold").length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({filterByStatus("pending").length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="space-y-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </TabsContent>
          <TabsContent value="draft" className="space-y-4">
            {filterByStatus("draft").map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </TabsContent>
          <TabsContent value="active" className="space-y-4">
            {filterByStatus("active").map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </TabsContent>
          <TabsContent value="sold" className="space-y-4">
            {filterByStatus("sold").map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </TabsContent>
          <TabsContent value="pending" className="space-y-4">
            {filterByStatus("pending").map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </TabsContent>
        </Tabs>
      )}

      <EndListingDialog
        listingId={endListingId}
        open={!!endListingId}
        onOpenChange={(open) => {
          if (!open) setEndListingId(null)
        }}
      />
    </div>
  )
}

"use client"

import Link from "next/link"
import { ChevronDown, ChevronUp, ExternalLink, Loader2, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RelatedContentThumb } from "@/components/features/admin/related-content/related-content-thumb"
import type { RelatedContentAdminItem } from "@/components/features/admin/related-content/related-content-admin-types"
import { listingDetailHref } from "@/lib/listing-href"

export function RelatedContentItemRows({
  items,
  reordering,
  deletingRowId,
  onMove,
  onRemove,
}: {
  items: RelatedContentAdminItem[]
  reordering: boolean
  deletingRowId: string | null
  onMove: (rowId: string, direction: -1 | 1) => void
  onRemove: (rowId: string) => void
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing attached yet. Add a blog post or listing below.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => {
        const title = item.kind === "blog" ? item.blog?.title : item.listing?.title
        const image =
          item.kind === "blog" ? item.blog?.cover_image_url ?? null : item.listing?.primary_image_url ?? null
        const href =
          item.kind === "blog" && item.blog?.slug
            ? `/blog/${item.blog.slug}`
            : item.listing
              ? listingDetailHref({ id: item.listing.id, slug: item.listing.slug })
              : null

        return (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-border p-2"
          >
            <RelatedContentThumb src={image} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{title ?? "Missing item"}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{item.kind === "blog" ? "Blog" : "Listing"}</Badge>
                {item.visible_on_pdp ? (
                  <Badge variant="outline">Live on PDP</Badge>
                ) : (
                  <Badge variant="outline">Hidden on PDP</Badge>
                )}
                {item.kind === "blog" && item.blog && !item.blog.published ? (
                  <span className="text-xs text-muted-foreground">Unpublished</span>
                ) : null}
                {item.kind === "listing" && item.listing?.hidden_from_site ? (
                  <span className="text-xs text-muted-foreground">Hidden listing</span>
                ) : null}
              </div>
            </div>
            {href ? (
              <Button asChild type="button" size="icon" variant="ghost">
                <Link href={href} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">Open</span>
                </Link>
              </Button>
            ) : null}
            <div className="flex flex-col">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={reordering || index === 0}
                onClick={() => onMove(item.id, -1)}
              >
                <ChevronUp className="h-4 w-4" />
                <span className="sr-only">Move up</span>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={reordering || index === items.length - 1}
                onClick={() => onMove(item.id, 1)}
              >
                <ChevronDown className="h-4 w-4" />
                <span className="sr-only">Move down</span>
              </Button>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={deletingRowId === item.id}
              onClick={() => onRemove(item.id)}
            >
              {deletingRowId === item.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span className="sr-only">Remove</span>
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

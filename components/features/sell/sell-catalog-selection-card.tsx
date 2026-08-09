"use client"

import Image from "next/image"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { brandLogoDisplaySrc } from "@/lib/public-media-display-src"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"

export type SellCatalogSelectionCardData = {
  brandName: string
  modelName: string | null
  categoryLabel: string
  imageUrl: string | null
  imageIsLogo: boolean
}

/**
 * "Product info" card shown at the top of a sell form after the seller picked
 * a brand/model from the `/sell` catalog search — image plus what was matched,
 * with a remove action that unlinks the catalog selection.
 */
export function SellCatalogSelectionCard({
  selection,
  onRemove,
  className,
}: {
  selection: SellCatalogSelectionCardData
  onRemove?: () => void
  className?: string
}) {
  const displaySrc = selection.imageUrl?.trim()
    ? brandLogoDisplaySrc(selection.imageUrl)
    : null

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-xl border border-border bg-muted/20 p-3 sm:p-4",
        className,
      )}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-background sm:h-24 sm:w-24">
        {displaySrc ? (
          <Image
            src={displaySrc}
            alt={selection.modelName ?? selection.brandName}
            fill
            className={cn(selection.imageIsLogo ? "object-contain p-2" : "object-cover")}
            sizes="(max-width:640px) 80px, 96px"
            unoptimized={listingImageShouldBypassOptimization(displaySrc)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-bold text-cerulean">
            {selection.brandName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Catalog match
        </p>
        <p className="truncate text-base font-semibold leading-snug text-foreground sm:text-lg">
          {selection.brandName}
        </p>
        <dl className="space-y-0.5 text-sm">
          {selection.modelName ? (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 font-medium text-muted-foreground">Model</dt>
              <dd className="min-w-0 truncate text-foreground">{selection.modelName}</dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 font-medium text-muted-foreground">Category</dt>
            <dd className="min-w-0 truncate text-foreground">{selection.categoryLabel}</dd>
          </div>
        </dl>
      </div>

      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Remove
        </Button>
      ) : null}
    </div>
  )
}

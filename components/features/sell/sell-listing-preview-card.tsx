"use client"

import Image from "next/image"
import { ImageIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface SellListingPreviewCardProps {
  /** Listing title; falls back to brand + model, then a placeholder. */
  title?: string
  brand?: string
  model?: string
  /** Human-readable condition label (already resolved from the condition code). */
  conditionLabel?: string
  /** Raw price input as typed (e.g. "450"). */
  price?: string
  /** Display-ready image src (uploaded thumb or local blob preview). */
  imageSrc?: string
  className?: string
}

function formatPreviewPrice(price: string | undefined): string | null {
  const trimmed = price?.trim()
  if (!trimmed) return null
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return `$${numeric.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

/**
 * Live "what buyers will see" mini card for the sell flow sidebar.
 * Fills in as the seller types — display-only, no interaction.
 */
export function SellListingPreviewCard({
  title,
  brand,
  model,
  conditionLabel,
  price,
  imageSrc,
  className,
}: SellListingPreviewCardProps) {
  const fallbackTitle = [brand?.trim(), model?.trim()].filter(Boolean).join(" ")
  const displayTitle = title?.trim() || fallbackTitle
  const displayPrice = formatPreviewPrice(price)

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Buyer preview
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-surface">
        <div className="relative aspect-[4/3] w-full bg-muted">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt="Listing photo preview"
              fill
              className="object-cover"
              sizes="224px"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImageIcon className="h-5 w-5" aria-hidden />
              <span className="text-[11px]">Photos appear here</span>
            </div>
          )}
        </div>
        <div className="space-y-1 p-3">
          <p
            className={cn(
              "line-clamp-2 text-sm font-medium leading-snug",
              displayTitle ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {displayTitle || "Your listing title"}
          </p>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "text-sm font-semibold",
                displayPrice ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {displayPrice ?? "$—"}
            </span>
            {conditionLabel ? (
              <span className="truncate text-[11px] text-muted-foreground">
                {conditionLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { Check, Loader2, Package, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useListingQuickDraft } from "@/components/features/dashboard/listings/hooks/use-listing-quick-draft"
import type { ListingQuickEditSaved } from "@/lib/services/listingQuickEdit"
import { listingDetailHref } from "@/lib/listing-href"
import { listingPhotoFillClassName } from "@/lib/listing-photo-fill"
import {
  capitalizeWords,
  LISTING_CONDITION_SELL_OPTIONS,
} from "@/lib/listing-labels"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import {
  isPeerListingSection,
  peerListingEditHref,
} from "@/lib/peer-listing-sections"
import {
  isShopPackageSizeId,
  shopPackageChipLabel,
  shopPackageSizesForSection,
  type ShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"
import { LISTING_QUICK_EDIT_DESCRIPTION_MAX } from "@/lib/validations/listing-quick-edit"
import { cn } from "@/lib/utils"

const PHOTO_SLOT_COUNT = 4

const deskControlClass =
  "h-9 rounded-md border border-border/80 bg-background text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-ring"

export type ListingDeskTableListing = {
  id: string
  slug: string | null
  title: string
  price: number
  status: string
  section: string
  condition: string | null
  description: string | null
  views: number
  cartCount: number
  favoriteCount: number
  created_at: string
  canDelete: boolean
  listing_images: { url: string; thumbnail_url?: string | null; is_primary: boolean | null }[] | null
  shipping_package_tier: string | null
  shipping_package_band: string | null
  shipping_packed_length_in: number | null
  shipping_packed_width_in: number | null
  shipping_packed_height_in: number | null
  shipping_packed_weight_oz: number | null
  brand: string | null
  model: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  board_shipping_cost_mode: string | null
  shipping_price: number | null
  dropoff_location_id: string | null
  dimensions: string | null
  length_total_inches: number | null
  volume_liters: number | null
  fins_setup: string | null
  fin_system: string | null
  construction: string | null
  fins_included: boolean | null
  tail_shape: string | null
  fin_size: string | null
  wetsuit_size: string | null
  apparel_kind: string | null
  traction_size: string | null
}

interface ListingDeskTableRowProps {
  listing: ListingDeskTableListing
  appliedPackageSizeId?: ShopPackageSizeId | null
  packageSyncNonce?: number
  onSaved: (listingId: string, saved: ListingQuickEditSaved) => void
  onEndListing: (listingId: string) => void
  onDiscardDraft?: (listingId: string) => void
}

function brandLine(listing: ListingDeskTableListing): string | null {
  const parts = [listing.brand?.trim(), listing.model?.trim()].filter(Boolean)
  return parts.length > 0 ? parts.join(" — ") : null
}

function weightOzFromDraft(packageWeightLb: string, packageWeightOz: string): string {
  const lb = Number(packageWeightLb)
  const oz = Number(packageWeightOz)
  const total =
    (Number.isFinite(lb) ? lb * 16 : 0) + (Number.isFinite(oz) ? oz : 0)
  if (!Number.isFinite(total) || total <= 0) return ""
  return String(Math.round(total * 100) / 100)
}

export function ListingDeskTableRow({
  listing,
  appliedPackageSizeId = null,
  packageSyncNonce = 0,
  onSaved,
  onEndListing,
  onDiscardDraft,
}: ListingDeskTableRowProps) {
  const { editable, draft, status, error, updateDraft } = useListingQuickDraft({
    listing,
    appliedPackageSizeId,
    packageSyncNonce,
    onSaved,
  })

  const editHref = peerListingEditHref(listing.section, listing.id)
  const viewHref =
    listing.status === "draft" ? editHref : listingDetailHref(listing)
  const displayTitle = capitalizeWords(draft.title || listing.title)
  const subtitle = brandLine(listing)
  const listedDate = format(new Date(listing.created_at), "MMM d, yyyy")
  const photos = (listing.listing_images ?? []).filter((image) => image.url)
  const packageSizes = isPeerListingSection(listing.section)
    ? shopPackageSizesForSection(listing.section)
    : []
  const weightOz = weightOzFromDraft(draft.spec.packageWeightLb, draft.spec.packageWeightOz)
  const packageSelectValue =
    draft.packageSizeId === "custom"
      ? "custom"
      : isShopPackageSizeId(draft.packageSizeId)
        ? draft.packageSizeId
        : packageSizes[0]
          ? "__unset__"
          : "custom"
  const isDraft = listing.status === "draft"
  const showRemove = isDraft ? Boolean(onDiscardDraft) : listing.canDelete || listing.status === "active"

  return (
    <tr className="border-b border-border/70 align-top last:border-b-0">
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-start gap-1.5">
          {Array.from({ length: PHOTO_SLOT_COUNT }).map((_, index) => {
            const image = photos[index]
            if (!image) {
              return (
                <div
                  key={`empty-${index}`}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border/80 bg-muted/40"
                  aria-hidden
                >
                  {index === 0 && photos.length === 0 ? (
                    <Package className="h-5 w-5 text-muted-foreground" />
                  ) : null}
                </div>
              )
            }
            const src = image.thumbnail_url || image.url
            return (
              <div
                key={src}
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted"
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  className={listingPhotoFillClassName}
                  sizes="56px"
                  unoptimized={listingImageShouldBypassOptimization(src)}
                />
              </div>
            )
          })}
          <Link
            href={editHref}
            className="flex h-14 min-w-[5.5rem] flex-col items-center justify-center rounded-md border border-dashed border-border/80 px-2 text-center text-[11px] leading-tight text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <span className="font-medium">Add photos</span>
            <span>Open editor</span>
          </Link>
        </div>
      </td>

      <td className="px-3 py-3 min-w-[10rem] max-w-[14rem]">
        <Link
          href={viewHref}
          className="text-[14px] font-medium text-primary underline-offset-2 hover:underline"
        >
          {displayTitle || "Untitled listing"}
        </Link>
        {subtitle ? (
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{subtitle}</p>
        ) : null}
        {status === "error" && error ? (
          <p className="mt-1 text-[12px] text-destructive">{error}</p>
        ) : null}
      </td>

      <td className="px-3 py-3 whitespace-nowrap">
        <p className="text-[13px] font-medium text-foreground">{listedDate}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Views: {listing.views.toLocaleString()}
          <br />
          Carts: {listing.cartCount.toLocaleString()}
        </p>
      </td>

      <td className="px-3 py-3">
        {editable ? (
          <Select
            value={draft.condition || undefined}
            onValueChange={(condition) => updateDraft({ condition })}
          >
            <SelectTrigger className={cn(deskControlClass, "w-[8.5rem]")} aria-label="Condition">
              <SelectValue placeholder="Condition" />
            </SelectTrigger>
            <SelectContent>
              {LISTING_CONDITION_SELL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-[13px] text-muted-foreground">—</span>
        )}
      </td>

      <td className="px-3 py-3">
        {editable && packageSizes.length > 0 ? (
          <div className="flex w-[7.5rem] flex-col gap-1.5">
            <Select
              value={packageSelectValue}
              onValueChange={(value) => {
                if (value === "__unset__") return
                updateDraft({ packageSizeId: value })
              }}
            >
              <SelectTrigger className={deskControlClass} aria-label="Package size">
                <SelectValue placeholder="Package" />
              </SelectTrigger>
              <SelectContent>
                {draft.packageSizeId === "custom" || packageSelectValue === "custom" ? (
                  <SelectItem value="custom">Custom</SelectItem>
                ) : null}
                {packageSelectValue === "__unset__" ? (
                  <SelectItem value="__unset__" disabled>
                    Choose size
                  </SelectItem>
                ) : null}
                {packageSizes.map((sizeId) => (
                  <SelectItem key={sizeId} value={sizeId}>
                    {shopPackageChipLabel(sizeId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Input
                inputMode="decimal"
                value={weightOz}
                aria-label="Packed weight in ounces"
                placeholder="0"
                onChange={(event) =>
                  updateDraft({
                    spec: {
                      packageWeightLb: "0",
                      packageWeightOz: event.target.value,
                    },
                  })
                }
                className={cn(deskControlClass, "pr-8 tabular-nums")}
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                oz
              </span>
            </div>
          </div>
        ) : (
          <span className="text-[13px] text-muted-foreground">—</span>
        )}
      </td>

      <td className="px-3 py-3">
        {editable ? (
          <div className="relative w-[5.5rem]">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
              $
            </span>
            <Input
              inputMode="decimal"
              value={draft.priceInput}
              aria-label="Price"
              onChange={(event) => updateDraft({ priceInput: event.target.value })}
              className={cn(deskControlClass, "pl-5 tabular-nums")}
            />
          </div>
        ) : (
          <span className="text-[13px] font-medium tabular-nums">
            ${Number(listing.price).toLocaleString()}
          </span>
        )}
      </td>

      <td className="px-3 py-3 min-w-[12rem] max-w-[18rem]">
        {editable ? (
          <Input
            value={draft.description}
            maxLength={LISTING_QUICK_EDIT_DESCRIPTION_MAX}
            aria-label="Seller description"
            placeholder="Condition notes, what’s included…"
            onChange={(event) => updateDraft({ description: event.target.value })}
            className={cn(deskControlClass, "w-full min-w-[12rem]")}
          />
        ) : (
          <p className="line-clamp-2 text-[12px] text-muted-foreground">
            {draft.description || "—"}
          </p>
        )}
      </td>

      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <Button asChild variant="outline" size="sm" className="h-9 rounded-md px-3 text-[13px]">
            <Link href={editHref}>Edit</Link>
          </Button>
          {showRemove ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-md"
              aria-label={isDraft ? `Discard draft ${displayTitle}` : `End listing ${displayTitle}`}
              onClick={() => {
                if (isDraft && onDiscardDraft) {
                  onDiscardDraft(listing.id)
                  return
                }
                onEndListing(listing.id)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
          {status === "saving" || status === "saved" ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" aria-live="polite">
              {status === "saving" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden />
              )}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowLeft, MapPin, Truck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ImageGallery } from "@/components/image-gallery"
import {
  capitalizeWords,
  formatBoardType,
  formatCategory,
  formatCondition,
} from "@/lib/listing-labels"
import { boardFulfillmentSummary } from "@/lib/listing-fulfillment"

const LocationMap = dynamic(
  () => import("@/components/location-map").then((m) => ({ default: m.LocationMap })),
  { loading: () => <div className="h-[280px] rounded-lg bg-muted animate-pulse" /> },
)

export type SellListingLivePreviewGalleryImage = {
  id: string
  url: string
  is_primary: boolean
}

export type SellListingLivePreviewProps = {
  variant: "board" | "used"
  title: string
  price: number
  condition: string
  categoryName: string | null
  description: string
  galleryImages: SellListingLivePreviewGalleryImage[]
  boardType?: string | null
  boardLengthDisplay?: string | null
  localPickup: boolean
  shippingAvailable: boolean
  shippingPrice?: number
  usedExtraLines?: string[]
  city?: string
  state?: string
  locationDisplay?: string
  latitude?: number
  longitude?: number
  sellerName: string
  sellerAvatarUrl?: string | null
  sellerLocationLine?: string | null
  brandLabel?: string | null
}

export function SellListingLivePreview({
  variant,
  title,
  price,
  condition,
  categoryName,
  description,
  galleryImages,
  boardType,
  boardLengthDisplay,
  localPickup,
  shippingAvailable,
  shippingPrice = 0,
  usedExtraLines = [],
  city,
  state,
  locationDisplay,
  latitude,
  longitude,
  sellerName,
  sellerAvatarUrl,
  sellerLocationLine,
  brandLabel,
}: SellListingLivePreviewProps) {
  const displayTitle = capitalizeWords(title) || "Your listing"
  const pickupOffered = localPickup !== false
  const shippingOffered = !!shippingAvailable
  const cityState =
    city && state ? `${city}, ${state}` : locationDisplay?.trim() || ""

  const galleryUnoptimized = galleryImages.some((im) => {
    const u = im.url || ""
    return u.startsWith("blob:") || u.startsWith("data:")
  })

  const metaParts =
    variant === "board"
      ? [
          formatCondition(condition),
          boardType ? formatBoardType(boardType) : null,
          boardLengthDisplay || null,
          boardFulfillmentSummary(localPickup, shippingAvailable),
        ]
      : [
          formatCondition(condition),
          categoryName ? formatCategory(categoryName) : null,
          boardFulfillmentSummary(localPickup, shippingAvailable),
        ]

  return (
    <div className="w-full">
      <p className="mb-4 rounded-lg border border-dashed border-primary/30 bg-primary/[0.04] px-3 py-2 text-center text-sm text-muted-foreground">
        Preview — this is how your listing will look to buyers after you publish.
      </p>

      {variant === "board" && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <Link href="/boards" className="hover:text-foreground">
              Back to Surfboards
            </Link>
          </span>
          {boardType ? (
            <>
              <span aria-hidden>/</span>
              <span className="capitalize">{boardType.replace(/_/g, " ")}</span>
            </>
          ) : null}
        </div>
      )}

      {variant === "used" && categoryName && (
        <nav className="mb-6" aria-label="Listing category">
          <Link
            href="/gear"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {formatCategory(categoryName)}
          </Link>
        </nav>
      )}

      <div className="grid gap-8 lg:grid-cols-2 lg:max-w-5xl lg:mx-auto">
        <div>
          <ImageGallery
            images={galleryImages}
            title={displayTitle}
            unoptimized={galleryUnoptimized}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <h1 className="text-xl font-bold break-words sm:text-2xl">{displayTitle}</h1>
            <p className="mt-2 text-2xl font-bold text-black dark:text-white sm:text-3xl tabular-nums">
              ${price.toFixed(2)}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">{metaParts.filter(Boolean).join(" · ")}</p>

          {variant === "used" && shippingOffered && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              <Truck className="h-4 w-4 shrink-0" />
              {shippingPrice <= 0 ? "Free shipping" : `+$${shippingPrice.toFixed(2)} shipping`}
            </p>
          )}

          {variant === "board" && shippingOffered && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              <Truck className="h-4 w-4 shrink-0" />
              {shippingPrice <= 0 ? "Free shipping" : `+$${shippingPrice.toFixed(2)} shipping`}
            </p>
          )}

          {usedExtraLines.map((line) => (
            <p key={line} className="text-sm text-muted-foreground">
              {line}
            </p>
          ))}

          <div>
            <h2 className="mb-2 font-semibold">Description</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground">
              <p className="whitespace-pre-wrap">{description || "—"}</p>
            </div>
          </div>

          {brandLabel?.trim() ? (
            <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm">
              <p className="mb-1 text-muted-foreground">Brand</p>
              <p className="font-medium text-foreground">{brandLabel.trim()}</p>
            </div>
          ) : null}

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={sellerAvatarUrl ?? undefined} alt="" />
                  <AvatarFallback>{sellerName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{sellerName}</p>
                  {sellerLocationLine ? (
                    <p className="text-sm text-muted-foreground">{sellerLocationLine}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground mt-1">You&apos;ll appear as the seller</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {variant === "board" && (
            <Card className="overflow-hidden border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-primary">
                  <MapPin className="h-5 w-5 shrink-0" />
                  <span className="font-medium">{cityState || "Set your pickup / ship-from area"}</span>
                </div>
                <p className="mb-3 mt-1 text-sm text-muted-foreground">
                  {pickupOffered && shippingOffered &&
                    "Approximate area for pickup, or the seller can ship this board to you."}
                  {pickupOffered && !shippingOffered &&
                    "Approximate pickup area for meeting the seller and inspecting the board."}
                  {!pickupOffered &&
                    shippingOffered &&
                    "Seller ships this board. Use checkout to pay, then confirm your shipping address in messages."}
                </p>
                {pickupOffered && latitude && longitude ? (
                  <LocationMap
                    lat={latitude}
                    lng={longitude}
                    label={cityState || "Pickup Location"}
                    showDirections
                    height={280}
                  />
                ) : pickupOffered && locationDisplay?.trim() ? (
                  <div className="flex h-[200px] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
                    <MapPin className="mr-2 h-5 w-5 shrink-0" />
                    {locationDisplay}
                  </div>
                ) : !pickupOffered ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    Map is shown when the seller offers local pickup.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

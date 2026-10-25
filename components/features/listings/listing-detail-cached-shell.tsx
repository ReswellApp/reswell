import { ImageGallery } from "@/components/image-gallery"
import { capitalizeWords } from "@/lib/listing-labels"
import { orderedListingGalleryImages } from "@/lib/listing-image-display"
import { formatListingDimensionsLine } from "@/lib/listing-dimensions-display"
import { primaryListingVideo, type ListingPdpVideoSource } from "@/lib/primary-listing-video"
import type { PublicListingRow } from "@/components/features/listings/listing-detail-public-body"

type GalleryImage = {
  id: string
  url: string
  is_primary: boolean
  thumbnail_url?: string | null
  pdp_crop_zoom?: number | null
  pdp_crop_x?: number | null
  pdp_crop_y?: number | null
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function galleryImages(listing: PublicListingRow): GalleryImage[] {
  return orderedListingGalleryImages(listing.listing_images).flatMap((image, index) => {
    const url = readString(image.url)
    if (!url) return []
    const id = readString((image as { id?: unknown }).id) || `photo-${index}`
    return [
      {
        id,
        url,
        is_primary: image.is_primary === true,
        thumbnail_url: readString(image.thumbnail_url) || null,
        pdp_crop_zoom: readNumber((image as { pdp_crop_zoom?: unknown }).pdp_crop_zoom),
        pdp_crop_x: readNumber((image as { pdp_crop_x?: unknown }).pdp_crop_x),
        pdp_crop_y: readNumber((image as { pdp_crop_y?: unknown }).pdp_crop_y),
      },
    ]
  })
}

function listingVideo(listing: PublicListingRow): ListingPdpVideoSource | null {
  if (!Array.isArray(listing.listing_videos)) return null
  const videos = listing.listing_videos.flatMap((video) => {
    if (!video || typeof video !== "object") return []
    const row = video as ListingPdpVideoSource
    const url = readString(row.url)
    if (!url) return []
    return [{ ...row, url }]
  })
  return primaryListingVideo(videos)
}

/**
 * First paint of `/l` from the listing row already in hand. The section page
 * still loads reviews and purchase state behind this; swapping in a shimmer
 * skeleton was the white flat.
 */
export function ListingDetailCachedShell({ listing }: { listing: PublicListingRow }) {
  const title = capitalizeWords(readString(listing.title))
  const dimensions = readString(listing.dimensions)
  const dimensionsLine = dimensions
    ? formatListingDimensionsLine({ dimensions })
    : null

  return (
    <main className="relative flex w-full min-w-0 max-w-full flex-1 flex-col self-stretch overflow-x-clip bg-background pb-16 pt-2 sm:pb-24 sm:pt-3 lg:pt-8">
      <div className="container mx-auto w-full min-w-0 max-w-full px-4 sm:px-6 lg:px-8 lg:!max-w-[min(100%,1320px)] xl:!max-w-[min(100%,1480px)] 2xl:!max-w-[min(100%,1680px)]">
        <div className="mb-3 min-h-6 min-w-0 max-w-full pt-0.5 max-lg:mb-4 lg:mb-8" />
        <div className="mx-auto grid w-full min-w-0 max-w-full gap-x-8 gap-y-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start lg:gap-x-12 xl:gap-x-16">
          <div className="min-w-0 max-lg:order-1 md:mx-auto md:max-w-[24rem] lg:mx-0 lg:w-full lg:max-w-[26rem] lg:justify-self-start xl:max-w-[28rem]">
            <ImageGallery
              images={galleryImages(listing)}
              video={listingVideo(listing)}
              title={title}
              sold={listing.status === "sold"}
              compactMobile
              dimensionsLine={dimensionsLine}
            />
            {title ? (
              <h1 className="mt-3 min-w-0 text-balance text-[1.375rem] font-bold leading-snug tracking-[-0.02em] text-foreground max-lg:line-clamp-2 lg:hidden">
                {title}
              </h1>
            ) : null}
          </div>
          {title ? (
            <div className="hidden min-w-0 lg:block">
              <h1 className="text-balance text-[2rem] font-bold leading-snug tracking-[-0.025em] text-foreground xl:text-[2.125rem]">
                {title}
              </h1>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}

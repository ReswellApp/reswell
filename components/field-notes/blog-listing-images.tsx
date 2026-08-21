import Image from "next/image"
import Link from "next/link"
import { listingDetailHref } from "@/lib/listing-href"
import { listingHeroSlideSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { BlogEmbedListing } from "@/lib/types/blog-listing-embed"
import { cn } from "@/lib/utils"

const MAX_PHOTOS = 4

function orderedListingPhotos(images: ListingImageForCard[] | null | undefined): ListingImageForCard[] {
  const list = [...(images ?? [])]
  list.sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return 0
  })
  return list.slice(0, MAX_PHOTOS)
}

function photoSrc(img: ListingImageForCard): string | null {
  return listingHeroSlideSrc([img])
}

export function BlogListingImages({
  listing,
  caption,
}: {
  listing: BlogEmbedListing
  caption?: string
}) {
  const photos = orderedListingPhotos(listing.listing_images)
    .map((img) => ({ img, src: photoSrc(img) }))
    .filter((row): row is { img: ListingImageForCard; src: string } => Boolean(row.src))

  if (photos.length === 0) return null

  const href = listingDetailHref({
    id: listing.id,
    slug: listing.slug,
    section: listing.section,
  })
  const grid = photos.length > 1

  return (
    <figure className="mt-8 space-y-2">
      <div className={cn(grid ? "grid grid-cols-2 gap-2" : "block")}>
        {photos.map((photo, i) => (
          <Link
            key={`${listing.id}-${i}`}
            href={href}
            className="relative block aspect-[4/5] overflow-hidden bg-[#04070E]"
          >
            <Image
              src={photo.src}
              alt={listing.title}
              fill
              sizes={grid ? "(max-width: 768px) 50vw, 336px" : "(max-width: 768px) 100vw, 672px"}
              className="object-cover"
              unoptimized={listingImageShouldBypassOptimization(photo.src)}
            />
          </Link>
        ))}
      </div>
      {caption?.trim() ? (
        <figcaption className="text-sm leading-relaxed text-muted-foreground">{caption.trim()}</figcaption>
      ) : null}
    </figure>
  )
}

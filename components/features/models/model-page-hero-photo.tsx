"use client"

import Image from "next/image"
import Link from "next/link"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { FavoriteButtonCardOverlay } from "@/components/favorite-button-card-overlay"
import { useModelPageViewer } from "@/components/features/models/model-page-viewer"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"

export function ModelPageHeroPhoto({
  imageUrl,
  alt,
  href,
  listingId,
  caption,
  brandName,
  brandLogoUrl,
}: {
  imageUrl: string | null
  alt: string
  href: string | null
  listingId: string | null
  caption: string | null
  brandName: string
  brandLogoUrl: string | null
}) {
  const viewer = useModelPageViewer()
  const favorited = listingId != null && viewer.ready ? viewer.favoritedIds.includes(listingId) : false
  const loggedIn = viewer.ready ? viewer.isLoggedIn : false

  const photo = imageUrl ? (
    <Image
      src={imageUrl}
      alt={alt}
      fill
      priority
      sizes="(max-width: 1024px) 24rem, 26rem"
      unoptimized={listingImageShouldBypassOptimization(imageUrl)}
      className="object-contain p-4"
    />
  ) : (
    <div className="flex h-full items-center justify-center">
      <BrandLogoMark
        name={brandName}
        logoUrl={brandLogoUrl}
        className="h-28 w-28 rounded-2xl text-2xl"
        imageSizes="112px"
      />
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-sm lg:mx-0 lg:max-w-[26rem]">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted/50">
        {href ? (
          <Link href={href} className="absolute inset-0" aria-label={alt}>
            {photo}
          </Link>
        ) : (
          photo
        )}
        {listingId ? (
          <FavoriteButtonCardOverlay
            listingId={listingId}
            initialFavorited={favorited}
            isLoggedIn={loggedIn}
          />
        ) : null}
      </div>
      {caption ? <p className="mt-2 text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  )
}

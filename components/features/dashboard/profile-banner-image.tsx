"use client"

import Image from "next/image"
import { wideShimmer } from "@/lib/image-shimmer"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import {
  profileBannerObjectPosition,
  resolveProfileBannerFocal,
  type ProfileBannerFocal,
} from "@/lib/utils/profile-banner-focal"
import { cn } from "@/lib/utils"

type ProfileBannerImageProps = {
  bannerUrl: string
  focalX?: number | null
  focalY?: number | null
  focal?: ProfileBannerFocal
  alt?: string
  fill?: boolean
  sizes?: string
  priority?: boolean
  className?: string
  placeholder?: "blur" | "empty"
}

export function ProfileBannerImage({
  bannerUrl,
  focalX,
  focalY,
  focal,
  alt = "",
  fill = true,
  sizes,
  priority = false,
  className,
  placeholder = "empty",
}: ProfileBannerImageProps) {
  const resolvedFocal = focal ?? resolveProfileBannerFocal(focalX, focalY)
  const src = profileMediaDisplaySrc(bannerUrl)
  const objectPosition = profileBannerObjectPosition(resolvedFocal)

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
      style={{ objectPosition }}
      unoptimized={listingImageShouldBypassOptimization(src)}
      placeholder={placeholder === "blur" ? "blur" : undefined}
      blurDataURL={placeholder === "blur" ? wideShimmer : undefined}
    />
  )
}

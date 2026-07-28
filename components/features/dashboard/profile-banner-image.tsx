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
  bannerUrl?: string | null
  previewSrc?: string | null
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

function isLocalPreviewSrc(src: string): boolean {
  return src.startsWith("blob:") || src.startsWith("data:")
}

export function ProfileBannerImage({
  bannerUrl,
  previewSrc,
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
  const preview = previewSrc?.trim() || ""
  const remote = bannerUrl?.trim() ? profileMediaDisplaySrc(bannerUrl) : ""
  const src = preview || remote
  if (!src) return null

  const localPreview = Boolean(preview && isLocalPreviewSrc(preview))
  const objectPosition = localPreview
    ? "50% 50%"
    : profileBannerObjectPosition(resolvedFocal)
  const useBlur = placeholder === "blur" && !localPreview

  return (
    <Image
      key={src}
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority || localPreview}
      className={cn("object-cover", className)}
      style={{ objectPosition }}
      unoptimized={localPreview || listingImageShouldBypassOptimization(src)}
      placeholder={useBlur ? "blur" : undefined}
      blurDataURL={useBlur ? wideShimmer : undefined}
    />
  )
}

"use client"

import { AvatarImage } from "@/components/ui/avatar"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import {
  profileBannerObjectPosition,
  resolveProfileBannerFocal,
} from "@/lib/utils/profile-banner-focal"
import { cn } from "@/lib/utils"

type ProfileAvatarImageProps = {
  avatarUrl?: string | null
  focalX?: number | null
  focalY?: number | null
  previewSrc?: string | null
  alt?: string
  className?: string
}

export function ProfileAvatarImage({
  avatarUrl,
  focalX,
  focalY,
  previewSrc,
  alt = "",
  className,
}: ProfileAvatarImageProps) {
  const src = previewSrc || (avatarUrl?.trim() ? profileMediaDisplaySrc(avatarUrl) : undefined)
  if (!src) return null

  const objectPosition = previewSrc
    ? "50% 50%"
    : profileBannerObjectPosition(resolveProfileBannerFocal(focalX, focalY))

  return (
    <AvatarImage
      src={src}
      alt={alt}
      className={cn("object-cover", className)}
      style={{ objectPosition }}
      key={`${src}:${objectPosition}`}
    />
  )
}

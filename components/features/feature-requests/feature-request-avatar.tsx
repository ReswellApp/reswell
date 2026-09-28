import Image from "next/image"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { featureRequestAuthorLabel } from "@/lib/utils/feature-requests"

interface FeatureRequestAvatarProps {
  displayName: string | null
  avatarUrl: string | null
}

export function FeatureRequestAvatar({ displayName, avatarUrl }: FeatureRequestAvatarProps) {
  const label = featureRequestAuthorLabel(displayName)
  const initial = label.replace(/^@/, "").trim()[0]?.toUpperCase() ?? "M"
  const src = avatarUrl ? profileMediaDisplaySrc(avatarUrl) : ""

  return (
    <span className="relative inline-flex h-5 w-5 shrink-0 overflow-hidden rounded-full bg-neutral-200">
      {src ? (
        <Image
          src={src}
          alt=""
          width={20}
          height={20}
          unoptimized={listingImageShouldBypassOptimization(src)}
          className="h-5 w-5 object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[10px] font-medium text-neutral-600">
          {initial}
        </span>
      )}
    </span>
  )
}

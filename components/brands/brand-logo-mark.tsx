"use client"

import { useState } from "react"
import Image from "next/image"
import { brandLogoDisplaySrc } from "@/lib/public-media-display-src"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import {
  brandMarkFallbackClassName,
  brandMarkInitials,
} from "@/lib/brands/logo-mark"
import { cn } from "@/lib/utils"

type BrandLogoMarkProps = {
  name: string
  logoUrl: string | null
  className?: string
  imageSizes: string
  /** Decorative marks in listboxes hide the logo alt. */
  decorative?: boolean
}

/**
 * Brand tile mark: catalog logo when present, otherwise a basic color profile
 * (initials on a deterministic Reswell-palette fill).
 */
export function BrandLogoMark({
  name,
  logoUrl,
  className,
  imageSizes,
  decorative = false,
}: BrandLogoMarkProps) {
  const src = logoUrl?.trim() ? brandLogoDisplaySrc(logoUrl.trim()) : ""
  const [imageFailed, setImageFailed] = useState(false)
  const showLogo = Boolean(src) && !imageFailed

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border border-border/60",
        showLogo ? "bg-background p-1.5 sm:p-2" : "flex items-center justify-center font-semibold",
        !showLogo && brandMarkFallbackClassName(name),
        className,
      )}
      aria-hidden={decorative || !showLogo}
    >
      {showLogo && src ? (
        <Image
          src={src}
          alt={decorative ? "" : `${name} logo`}
          fill
          className="object-contain object-center"
          sizes={imageSizes}
          unoptimized={listingImageShouldBypassOptimization(src)}
          onError={() => setImageFailed(true)}
        />
      ) : (
        brandMarkInitials(name)
      )}
    </div>
  )
}

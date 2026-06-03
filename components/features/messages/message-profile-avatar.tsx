"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Skeleton } from "@/components/ui/skeleton"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { cn } from "@/lib/utils"

const sizeClasses = {
  xs: "h-9 w-9",
  sm: "h-11 w-11",
  md: "h-12 w-12",
  lg: "h-16 w-16",
  inbox: "h-[52px] w-[52px]",
} as const

const imageSizes = {
  xs: "36px",
  sm: "44px",
  md: "48px",
  lg: "64px",
  inbox: "52px",
} as const

type MessageProfileAvatarProps = {
  avatarUrl?: string | null
  displayName?: string | null
  /** Parent row/profile is still loading — show skeleton instead of a letter fallback. */
  pending?: boolean
  size?: keyof typeof sizeClasses
  className?: string
  imageClassName?: string
}

export function MessageProfileAvatar({
  avatarUrl,
  displayName,
  pending = false,
  size = "sm",
  className,
  imageClassName,
}: MessageProfileAvatarProps) {
  const [imageReady, setImageReady] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const mountedRef = useRef(true)

  const rawUrl = avatarUrl?.trim() || null
  const trimmedUrl = rawUrl ? profileMediaDisplaySrc(rawUrl) : null
  const trimmedName = displayName?.trim() || ""
  const initial = trimmedName[0]?.toUpperCase() ?? null

  useEffect(() => {
    mountedRef.current = true
    setImageReady(false)
    setImageFailed(false)
    return () => {
      mountedRef.current = false
    }
  }, [trimmedUrl])

  const waitingForImage = !!trimmedUrl && !imageReady && !imageFailed
  const showSkeleton = pending || waitingForImage || (!trimmedUrl && !initial && !pending)
  const showInitial = !pending && !trimmedUrl && !!initial
  const showInitialAfterImageError = !pending && imageFailed && !!initial

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border/60",
        sizeClasses[size],
        className,
      )}
      aria-hidden={pending || waitingForImage ? true : undefined}
    >
      {showSkeleton ? (
        <Skeleton className="absolute inset-0 z-10 h-full w-full rounded-full" />
      ) : null}

      {trimmedUrl && !imageFailed ? (
        <Image
          src={trimmedUrl}
          alt={trimmedName || "Profile photo"}
          fill
          sizes={imageSizes[size]}
          unoptimized={listingImageShouldBypassOptimization(trimmedUrl)}
          className={cn("object-cover", imageClassName)}
          onLoad={() => {
            if (mountedRef.current) setImageReady(true)
          }}
          onError={() => {
            if (!mountedRef.current) return
            setImageFailed(true)
            setImageReady(false)
          }}
        />
      ) : null}

      {showInitial || showInitialAfterImageError ? (
        <div className="flex h-full w-full items-center justify-center text-[15px] font-semibold text-foreground">
          {initial}
        </div>
      ) : null}
    </div>
  )
}

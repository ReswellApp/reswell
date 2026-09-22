"use client"

import Image from "next/image"
import type { DragEvent, SyntheticEvent } from "react"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"

type ListingMediaFillImageProps = {
  src: string
  alt: string
  className?: string
  sizes?: string
  priority?: boolean
  fetchPriority?: "high" | "low" | "auto"
  loading?: "eager" | "lazy"
  draggable?: boolean
  "aria-hidden"?: boolean
  onDragStart?: (event: DragEvent<HTMLImageElement>) => void
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void
  ref?: (img: HTMLImageElement | null) => void
}

/**
 * Listing photos are already sized by `/media/listings`. A same-origin
 * `next/image` with `unoptimized` appends `?dpl=` and splits the CDN cache
 * on every deploy, so those URLs render as a plain image.
 */
export function ListingMediaFillImage({
  src,
  alt,
  className,
  sizes,
  priority = false,
  fetchPriority,
  loading,
  draggable,
  "aria-hidden": ariaHidden,
  onDragStart,
  onLoad,
  onError,
  ref,
}: ListingMediaFillImageProps) {
  if (src.startsWith("/")) {
    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        draggable={draggable}
        aria-hidden={ariaHidden}
        loading={priority ? "eager" : loading}
        fetchPriority={priority ? "high" : fetchPriority}
        onDragStart={onDragStart}
        onLoad={onLoad}
        onError={onError}
        className={cn("absolute inset-0 h-full w-full", className)}
      />
    )
  }

  return (
    <Image
      ref={ref}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      fetchPriority={fetchPriority}
      loading={loading}
      draggable={draggable}
      aria-hidden={ariaHidden}
      unoptimized={listingImageShouldBypassOptimization(src)}
      onDragStart={onDragStart}
      onLoad={onLoad}
      onError={onError}
      className={className}
    />
  )
}

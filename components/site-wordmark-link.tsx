"use client"

import Link from "next/link"
import { useCallback, useRef } from "react"
import reswellLogoPng from "@/public/images/reswell-logo.png"
import { cn } from "@/lib/utils"

/**
 * When `public/images/reswell-logo.svg` exists at build time, we load vector first (`NEXT_PUBLIC_SITE_WORDMARK_USE_VECTOR_SVG` from `next.config.mjs`).
 * Otherwise PNG is inlined as `src`; on vector decode/network errors `onError` falls back to raster.
 */

const VECTOR_SRC = "/images/reswell-logo.svg"

const VECTOR_FIRST =
  process.env.NEXT_PUBLIC_SITE_WORDMARK_USE_VECTOR_SVG === "true"

const PNG_SRC = typeof reswellLogoPng !== "string" ? reswellLogoPng.src : reswellLogoPng

const PNG_WIDTH = typeof reswellLogoPng !== "string" ? reswellLogoPng.width : undefined
const PNG_HEIGHT = typeof reswellLogoPng !== "string" ? reswellLogoPng.height : undefined

/** Nav bar: cap width + height so a wide horizontal mark does not crowd search / actions. */
const IMG_HEADER =
  "h-auto max-h-5 w-auto max-w-[9rem] object-contain object-left sm:max-h-6 sm:max-w-[10.5rem] md:max-h-7 md:max-w-[12rem]"
/** Stacked mobile chrome row — stay a touch smaller next to icon cluster */
const IMG_HEADER_COMPACT =
  "h-auto max-h-5 w-auto max-w-[8.25rem] object-contain object-left sm:max-w-[9.5rem]"
const IMG_FOOTER =
  "h-auto w-auto max-h-24 max-w-[min(260px,100%)] object-contain object-left sm:max-h-28 md:max-h-32"

type SiteWordmarkLinkProps = {
  href?: string
  variant?: "header" | "footer"
  /**
   * When true (header variant only): fixed `h-7` wordmark — use in the stacked mobile chrome row.
   */
  compact?: boolean
  /** outer link padding / layout */
  className?: string
  /** extra image classes — merged after variant defaults */
  imgClassName?: string
}

export function SiteWordmarkLink({
  href = "/",
  variant = "header",
  compact = false,
  className,
  imgClassName,
}: SiteWordmarkLinkProps) {
  const isFooter = variant === "footer"
  const headerImg = compact ? IMG_HEADER_COMPACT : IMG_HEADER
  const imgClass = cn(isFooter ? IMG_FOOTER : headerImg, imgClassName)

  const swappedRef = useRef(false)

  const onRasterFallback = useCallback((event: { currentTarget: HTMLImageElement }) => {
    if (swappedRef.current) return
    swappedRef.current = true
    const el = event.currentTarget
    el.src = PNG_SRC
    const w = PNG_WIDTH ?? 996
    const h = PNG_HEIGHT ?? 137
    if (!el.width) el.width = w
    if (!el.height) el.height = h
  }, [])

  const initialSrc = VECTOR_FIRST ? VECTOR_SRC : PNG_SRC

  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center rounded-md px-2 py-1 no-underline hover:no-underline sm:px-2 sm:py-1.5",
        className,
      )}
    >
      <img
        src={initialSrc}
        alt="Reswell"
        className={imgClass}
        width={PNG_WIDTH}
        height={PNG_HEIGHT}
        fetchPriority={!isFooter ? "high" : undefined}
        decoding="async"
        onError={VECTOR_FIRST ? onRasterFallback : undefined}
      />
    </Link>
  )
}

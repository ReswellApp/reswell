"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from "react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Shared geometry for header nav typeahead “Top listings” and idle personalization rows. */
export const navSearchTopListingThumbClassName =
  "relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted sm:h-14 sm:w-14 sm:rounded-lg"

export const navSearchTopListingRowClassName =
  "mx-1 flex gap-2 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-muted/80 focus-visible:bg-muted/80 sm:gap-3 sm:rounded-xl sm:py-2.5"

export const navSearchTopListingTitleClassName =
  "line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base"

export const navSearchTopListingMetaClassName =
  "mt-0.5 line-clamp-1 text-[11px] text-muted-foreground sm:text-xs"

export const navSearchTopListingPriceClassName =
  "mt-0.5 text-sm font-semibold text-black dark:text-white sm:mt-1"

export function NavSearchTopListingSectionHeader({
  title,
  action,
  className,
}: {
  title: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-2.5",
        className,
      )}
    >
      <span className="text-xs font-semibold tracking-tight text-foreground sm:text-sm">
        {title}
      </span>
      {action}
    </div>
  )
}

export function NavSearchTopListingThumb({
  imageUrl,
  imageCandidates,
  imageSizes = "(max-width:640px) 48px, 56px",
}: {
  imageUrl: string | null
  imageCandidates?: string[]
  imageSizes?: string
}) {
  const candidates = useMemo(() => {
    const list = imageCandidates?.length
      ? imageCandidates
      : imageUrl
        ? [imageUrl]
        : []
    return [...new Set(list.map((url) => url.trim()).filter(Boolean))]
  }, [imageCandidates, imageUrl])

  const candidatesKey = candidates.join("|")
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [exhausted, setExhausted] = useState(false)

  useEffect(() => {
    setCandidateIndex(0)
    setExhausted(false)
  }, [candidatesKey])

  const src = candidates[candidateIndex] ?? ""

  const handleError = useCallback(
    (_event: SyntheticEvent<HTMLImageElement>) => {
      if (candidateIndex + 1 < candidates.length) {
        setCandidateIndex((index) => index + 1)
        return
      }
      setExhausted(true)
    },
    [candidateIndex, candidates.length],
  )

  return (
    <div className={navSearchTopListingThumbClassName}>
      {src && !exhausted ? (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          className="object-cover"
          sizes={imageSizes}
          unoptimized
          onError={handleError}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
          No photo
        </div>
      )}
    </div>
  )
}

export function NavSearchTopListingText({
  title,
  meta,
  price,
  trailing,
}: {
  title: string
  meta?: string | null
  price?: number | null
  trailing?: ReactNode
}) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className={navSearchTopListingTitleClassName}>{title}</p>
        {meta ? <p className={navSearchTopListingMetaClassName}>{meta}</p> : null}
        {price != null ? (
          <p className={navSearchTopListingPriceClassName}>${price.toFixed(2)}</p>
        ) : null}
      </div>
      {trailing}
    </>
  )
}

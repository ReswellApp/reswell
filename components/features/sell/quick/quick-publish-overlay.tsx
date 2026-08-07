"use client"

import { useEffect, useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { Loader2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"

export interface QuickPublishOverlayProps {
  title: string
  price: string
  coverUrl: string
}

/**
 * Full-viewport publishing takeover for Quick List — a single calm state
 * (simpler than the wizard's multi-phase labels). Ported to document.body so
 * ancestor transforms can't trap `position: fixed`.
 */
export function QuickPublishOverlay({ title, price, coverUrl }: QuickPublishOverlayProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!mounted) return
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = prev
    }
  }, [mounted])

  if (!mounted || typeof document === "undefined") return null

  const thumb = proxiedListingImageSrc(coverUrl) || "/placeholder.svg"

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background p-6 motion-safe:animate-in motion-safe:fade-in motion-reduce:animate-none duration-200"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={`Publishing listing: ${title}`}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-md sm:p-7">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Publishing
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Putting your board up
          </h2>
          <p className="text-sm text-muted-foreground">
            You&apos;ll go to your live listing in a moment.
          </p>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <div className="relative h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted shadow-inner">
            <Image src={thumb} alt="" fill className="object-cover object-center" unoptimized />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
              {title}
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">${price}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-muted/30 p-4 ring-1 ring-border/50">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-listingHeart" aria-hidden />
            <span>Saving your listing…</span>
          </p>
          <Progress value={66} className="h-1.5" />
        </div>
      </div>
    </div>,
    document.body,
  )
}

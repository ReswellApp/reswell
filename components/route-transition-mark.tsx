"use client"

import Image from "next/image"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/** Matches `duration-300` on the overlay; used if `transitionend` never fires (e.g. reduced motion). */
const OVERLAY_TRANSITION_MS = 300

const overlayEase =
  "transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none motion-reduce:duration-0"
const logoEase =
  "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none motion-reduce:duration-0"

function ReswellMarkImage({ className, visible }: { className?: string; visible: boolean }) {
  return (
    <Image
      src="/images/reswell-mark.png"
      alt=""
      width={256}
      height={256}
      className={cn(
        "h-auto w-[clamp(72px,15vw,112px)]",
        logoEase,
        visible ? "scale-100 opacity-100" : "scale-[0.96] opacity-0",
        className
      )}
      priority
    />
  )
}

type RouteTransitionMarkProps = {
  /**
   * `overlay` covers the viewport (for App Router `loading.tsx` under SiteChrome).
   * `inline` fills a flex main region without fixed positioning.
   */
  variant?: "overlay" | "inline"
}

export function RouteTransitionMark({ variant = "overlay" }: RouteTransitionMarkProps) {
  const [enter, setEnter] = useState(false)

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEnter(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const mark = <ReswellMarkImage visible={enter} />

  if (variant === "inline") {
    return (
      <main
        className={cn(
          "flex flex-1 flex-col items-center justify-center bg-white px-6 py-16",
          overlayEase,
          enter ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
      >
        {mark}
      </main>
    )
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-white",
        overlayEase,
        enter ? "opacity-100" : "opacity-0"
      )}
      aria-hidden
    >
      {mark}
    </div>
  )
}

type FadeRouteTransitionOverlayProps = {
  /** When true, overlay is visible (or animating in). When false, plays exit then unmounts. */
  open: boolean
  zIndex?: number
  onExitComplete?: () => void
}

/**
 * Full-screen Reswell overlay with enter/exit opacity (used after navigation while content is gated).
 */
export function FadeRouteTransitionOverlay({
  open,
  zIndex = 110,
  onExitComplete,
}: FadeRouteTransitionOverlayProps) {
  const [mounted, setMounted] = useState(false)
  const [paintVisible, setPaintVisible] = useState(false)
  const exitFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    if (open) {
      if (exitFallbackRef.current) {
        clearTimeout(exitFallbackRef.current)
        exitFallbackRef.current = null
      }
      setMounted(true)
      setPaintVisible(false)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPaintVisible(true))
      })
      return () => cancelAnimationFrame(id)
    }
    setPaintVisible(false)
  }, [open])

  /**
   * When `open` becomes false, opacity may change with no transition (reduced motion), so
   * `transitionend` never runs and the overlay would stay mounted as an invisible full-screen
   * layer above the header (z-110 vs z-50), blocking all clicks.
   */
  useEffect(() => {
    if (open || !mounted) return
    if (exitFallbackRef.current) clearTimeout(exitFallbackRef.current)
    exitFallbackRef.current = setTimeout(() => {
      exitFallbackRef.current = null
      setMounted(false)
      onExitComplete?.()
    }, OVERLAY_TRANSITION_MS + 80)
    return () => {
      if (exitFallbackRef.current) {
        clearTimeout(exitFallbackRef.current)
        exitFallbackRef.current = null
      }
    }
  }, [open, mounted, onExitComplete])

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== "opacity" || e.target !== e.currentTarget) return
    if (!open && mounted) {
      if (exitFallbackRef.current) {
        clearTimeout(exitFallbackRef.current)
        exitFallbackRef.current = null
      }
      setMounted(false)
      onExitComplete?.()
    }
  }

  if (!mounted) return null

  const show = open && paintVisible

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-white",
        overlayEase,
        show ? "opacity-100" : "opacity-0",
        // Invisible overlay must not capture clicks (opacity alone does not disable hit-testing).
        !show && "pointer-events-none",
      )}
      style={{ zIndex }}
      aria-hidden
      onTransitionEnd={handleTransitionEnd}
    >
      <ReswellMarkImage visible={show} />
    </div>
  )
}


"use client"

import { useEffect, useState, type ReactNode, type RefObject } from "react"
import { cn } from "@/lib/utils"

/** Extra page padding so the last listing cards clear the floating filter bar (mobile only). */
export const browseFiltersHoverBarClearanceClassName =
  "pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:pb-0"

export function BrowseFiltersHoverBar({
  children,
  hidden = false,
  label,
  dropoffSentinel,
}: {
  children: ReactNode
  hidden?: boolean
  label: string
  dropoffSentinel: RefObject<HTMLElement | null>
}) {
  const [listingsInView, setListingsInView] = useState(true)

  useEffect(() => {
    const node = dropoffSentinel.current
    if (!node) return

    let frame = 0
    const viewport = window.visualViewport

    const update = () => {
      const { bottom } = node.getBoundingClientRect()
      const viewportBottom = viewport
        ? viewport.offsetTop + viewport.height
        : window.innerHeight
      // Hide as soon as the line after Next / the last listing enters the screen.
      setListingsInView(bottom > viewportBottom)
    }

    const onScrollOrResize = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        update()
      })
    }

    update()
    window.addEventListener("scroll", onScrollOrResize, { passive: true })
    window.addEventListener("resize", onScrollOrResize)
    viewport?.addEventListener("resize", onScrollOrResize)
    viewport?.addEventListener("scroll", onScrollOrResize)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScrollOrResize)
      window.removeEventListener("resize", onScrollOrResize)
      viewport?.removeEventListener("resize", onScrollOrResize)
      viewport?.removeEventListener("scroll", onScrollOrResize)
    }
  }, [dropoffSentinel])

  const visible = !hidden && listingsInView

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:hidden",
        "transform-gpu transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "translate-y-[120%] opacity-0",
      )}
      role="toolbar"
      aria-label={label}
      aria-hidden={!visible}
      inert={!visible || undefined}
    >
      <div
        className={cn(
          "flex w-full max-w-[min(36rem,calc(100vw-1.5rem))] items-center justify-center gap-1 rounded-full border border-[#001A4A]/10",
          "bg-white/90 p-1.5 shadow-[0_12px_40px_-12px_rgba(0,26,74,0.38)] sm:w-auto sm:gap-1.5",
          "backdrop-blur-md supports-[backdrop-filter]:bg-white/80",
          visible ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        {children}
      </div>
    </div>
  )
}

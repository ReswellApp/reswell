"use client"

import { usePathname } from "next/navigation"
import { useLayoutEffect, useRef, useState } from "react"
import { FadeRouteTransitionOverlay } from "@/components/route-transition-mark"
import { cn } from "@/lib/utils"

const MAX_WAIT_MS = 12_000

function doubleRaf(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
}

function waitImage(img: HTMLImageElement, ms: number): Promise<void> {
  if (img.complete) return Promise.resolve()
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms)
    const done = () => {
      clearTimeout(t)
      resolve()
    }
    img.addEventListener("load", done, { once: true })
    img.addEventListener("error", done, { once: true })
  })
}

/**
 * Waits for webfonts, two animation frames, then non-lazy or near-viewport images
 * inside the page root (with a global deadline).
 */
async function waitForPageContent(root: HTMLElement, deadline: number) {
  await document.fonts.ready
  await doubleRaf()

  const margin =
    typeof window !== "undefined" ? window.innerHeight * 1.35 : 800
  const vw =
    typeof window !== "undefined" ? window.innerWidth : 1200

  const imgs = Array.from(root.querySelectorAll("img"))
  for (const img of imgs) {
    if (Date.now() > deadline) break
    const attrLazy = img.getAttribute("loading")
    const lazy = attrLazy === "lazy" || img.loading === "lazy"
    const rect = img.getBoundingClientRect()
    const nearViewport =
      rect.top < margin &&
      rect.bottom > -margin &&
      rect.left < vw &&
      rect.right > 0
    if (lazy && !nearViewport) continue
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await waitImage(img, Math.min(5000, remaining))
  }

  await doubleRaf()
}

/**
 * After client-side navigations, keeps the Reswell overlay up until fonts and
 * critical images have settled so the route does not flash incomplete UI.
 */
export function NavigationPageGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const routeKey = pathname
  const rootRef = useRef<HTMLDivElement>(null)
  const prevKeyRef = useRef<string | null>(null)
  const [overlayOpen, setOverlayOpen] = useState(false)

  useLayoutEffect(() => {
    if (prevKeyRef.current === null) {
      prevKeyRef.current = routeKey
      return
    }
    if (prevKeyRef.current === routeKey) return
    prevKeyRef.current = routeKey

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" })
    }

    setOverlayOpen(true)
    let cancelled = false
    void (async () => {
      const root = rootRef.current
      const deadline = Date.now() + MAX_WAIT_MS
      try {
        if (root) await waitForPageContent(root, deadline)
      } finally {
        if (!cancelled) setOverlayOpen(false)
      }
    })()

    return () => {
      cancelled = true
      setOverlayOpen(false)
    }
  }, [routeKey])

  return (
    <div ref={rootRef} className="relative flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          overlayOpen
            ? "pointer-events-none opacity-0 transition-none"
            : "opacity-100 transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none motion-reduce:duration-0"
        )}
        aria-hidden={overlayOpen}
      >
        {children}
      </div>
      <FadeRouteTransitionOverlay open={overlayOpen} zIndex={110} />
    </div>
  )
}

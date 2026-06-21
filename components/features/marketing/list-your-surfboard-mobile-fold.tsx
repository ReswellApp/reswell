"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type ListYourSurfboardMobileFoldProps = {
  children: React.ReactNode
  className?: string
}

/**
 * Locks the list-your-surfboard marketing fold to the viewport below site chrome.
 * The fold includes the in-flow mobile CTA at the bottom.
 */
export function ListYourSurfboardMobileFold({
  children,
  className,
}: ListYourSurfboardMobileFoldProps) {
  const foldRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const fold = foldRef.current
    if (!fold) return

    const desktopMq = window.matchMedia("(min-width: 1024px)")

    const syncFoldHeight = () => {
      if (desktopMq.matches) {
        fold.style.removeProperty("--lys-fold-height")
        return
      }

      const top = fold.getBoundingClientRect().top
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const height = Math.max(300, Math.round(viewportHeight - top))

      fold.style.setProperty("--lys-fold-height", `${height}px`)
    }

    syncFoldHeight()

    requestAnimationFrame(() => {
      syncFoldHeight()
      requestAnimationFrame(syncFoldHeight)
    })

    const observers: ResizeObserver[] = []

    const foldCta = fold.querySelector("[data-lys-fold-cta]")
    if (foldCta instanceof HTMLElement) {
      const ctaRo = new ResizeObserver(syncFoldHeight)
      ctaRo.observe(foldCta)
      observers.push(ctaRo)
    }

    const ro = new ResizeObserver(syncFoldHeight)
    ro.observe(document.documentElement)
    observers.push(ro)

    const headerShell = document.querySelector("[data-site-header-shell]")
    if (headerShell instanceof HTMLElement) {
      const headerRo = new ResizeObserver(syncFoldHeight)
      headerRo.observe(headerShell)
      observers.push(headerRo)
    }

    const categoryBar = document.querySelector("[data-site-top-category-bar]")
    if (categoryBar instanceof HTMLElement) {
      const categoryRo = new ResizeObserver(syncFoldHeight)
      categoryRo.observe(categoryBar)
      observers.push(categoryRo)
    }

    window.addEventListener("resize", syncFoldHeight)
    window.visualViewport?.addEventListener("resize", syncFoldHeight)
    desktopMq.addEventListener("change", syncFoldHeight)

    return () => {
      for (const observer of observers) observer.disconnect()
      window.removeEventListener("resize", syncFoldHeight)
      window.visualViewport?.removeEventListener("resize", syncFoldHeight)
      desktopMq.removeEventListener("change", syncFoldHeight)
    }
  }, [])

  return (
    <div
      ref={foldRef}
      className={cn("listyoursurfboard-mobile-fold lg:contents", className)}
    >
      {children}
    </div>
  )
}

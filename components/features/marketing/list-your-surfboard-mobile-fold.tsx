"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type ListYourSurfboardMobileFoldProps = {
  children: React.ReactNode
  className?: string
}

/**
 * Locks the list-your-surfboard marketing fold to the viewport below site chrome
 * so iPhone SE through Pro Max fit on one screen (reviews, hero, inline CTA).
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

    /** Distance from viewport top to fold — must not use live rect.top while scrolled. */
    let topInsetPx: number | null = null

    const measureTopInsetFromChrome = () => {
      const headerVar = getComputedStyle(document.documentElement)
        .getPropertyValue("--site-header-height")
        .trim()
      const headerHeight = Number.parseFloat(headerVar) || 64
      const categoryBar = document.querySelector("[data-site-top-category-bar]")
      const categoryHeight =
        categoryBar instanceof HTMLElement ? categoryBar.offsetHeight : 0
      return Math.round(headerHeight + categoryHeight)
    }

    const calibrateTopInset = () => {
      if (window.scrollY > 8) return
      const top = fold.getBoundingClientRect().top
      if (top > 0) topInsetPx = Math.round(top)
    }

    const syncFoldHeight = () => {
      if (desktopMq.matches) {
        fold.style.removeProperty("--lys-fold-height")
        return
      }

      calibrateTopInset()
      const topInset = topInsetPx ?? measureTopInsetFromChrome()

      const vv = window.visualViewport
      const viewportHeight = vv?.height ?? window.innerHeight
      const height = Math.max(300, Math.round(viewportHeight - topInset))

      fold.style.setProperty("--lys-fold-height", `${height}px`)
    }

    const syncAfterChromeResize = () => {
      topInsetPx = measureTopInsetFromChrome()
      syncFoldHeight()
    }

    syncFoldHeight()

    requestAnimationFrame(() => {
      syncFoldHeight()
      requestAnimationFrame(syncFoldHeight)
    })

    const observers: ResizeObserver[] = []

    const ro = new ResizeObserver(syncFoldHeight)
    ro.observe(document.documentElement)
    observers.push(ro)

    const headerShell = document.querySelector("[data-site-header-shell]")
    if (headerShell instanceof HTMLElement) {
      const headerRo = new ResizeObserver(syncAfterChromeResize)
      headerRo.observe(headerShell)
      observers.push(headerRo)
    }

    const categoryBar = document.querySelector("[data-site-top-category-bar]")
    if (categoryBar instanceof HTMLElement) {
      const categoryRo = new ResizeObserver(syncAfterChromeResize)
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

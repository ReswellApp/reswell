"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type ListYourSurfboardMobileFoldProps = {
  children: React.ReactNode
  className?: string
}

/**
 * Locks the list-your-surfboard marketing fold height once on landing.
 * Ignores scroll-driven viewport chrome changes (Meta IAB, iOS Safari).
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
    let frozen = false
    let lastInnerWidth = window.innerWidth

    const clearLock = () => {
      frozen = false
      fold.style.removeProperty("--lys-fold-height")
    }

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

    const lockFoldHeight = (options?: { relock?: boolean }) => {
      if (desktopMq.matches) {
        clearLock()
        return
      }

      if (frozen && !options?.relock) return

      const topInset = measureTopInsetFromChrome()
      const height = Math.max(300, Math.round(window.innerHeight - topInset))

      fold.style.setProperty("--lys-fold-height", `${height}px`)
    }

    const finalizeLock = () => {
      lockFoldHeight()
      frozen = true
    }

    lockFoldHeight()

    requestAnimationFrame(() => {
      lockFoldHeight()
      requestAnimationFrame(finalizeLock)
    })

    const onWindowResize = () => {
      if (window.innerWidth === lastInnerWidth) return
      lastInnerWidth = window.innerWidth
      lockFoldHeight({ relock: true })
      frozen = true
    }

    const onOrientationChange = () => {
      lastInnerWidth = window.innerWidth
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          lockFoldHeight({ relock: true })
          frozen = true
        })
      })
    }

    const onDesktopMqChange = () => {
      frozen = false
      lockFoldHeight()
      frozen = true
    }

    window.addEventListener("resize", onWindowResize)
    window.addEventListener("orientationchange", onOrientationChange)
    desktopMq.addEventListener("change", onDesktopMqChange)

    return () => {
      window.removeEventListener("resize", onWindowResize)
      window.removeEventListener("orientationchange", onOrientationChange)
      desktopMq.removeEventListener("change", onDesktopMqChange)
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

"use client"

import { useLayoutEffect, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"

const SITE_HEADER_HEIGHT_VAR = "--site-header-height"

/**
 * Keeps the marketing header pinned to the viewport so Radix menu scroll-lock
 * cannot shift the whole document (and the nav) off-screen.
 */
export function SiteHeaderShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const shellRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = shellRef.current
    if (!el || typeof document === "undefined") return

    const syncHeight = () => {
      document.documentElement.style.setProperty(SITE_HEADER_HEIGHT_VAR, `${el.offsetHeight}px`)
    }

    syncHeight()
    const ro = new ResizeObserver(syncHeight)
    ro.observe(el)
    window.addEventListener("resize", syncHeight)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", syncHeight)
    }
  }, [])

  return (
    <div
      ref={shellRef}
      data-site-header-shell
      className={cn(
        "fixed inset-x-0 top-0 z-[60] isolate w-full bg-background pt-[env(safe-area-inset-top)] shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  )
}

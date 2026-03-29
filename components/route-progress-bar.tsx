"use client"

import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

type BarState = "idle" | "loading" | "completing"

/**
 * Thin top-of-page progress bar that appears on internal link navigation.
 * Detects navigation start via document click interception and completion via
 * usePathname() change — no router wrapping required.
 */
export function RouteProgressBar() {
  const pathname = usePathname()
  const [barState, setBarState] = useState<BarState>("idle")
  const prevPathnameRef = useRef(pathname)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  // Intercept anchor clicks to detect navigation start
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href") ?? ""
      if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) return
      if (anchor.target === "_blank") return
      // Skip same-page navigations
      const targetPath = href.split("?")[0].split("#")[0]
      if (targetPath === window.location.pathname) return

      clearHideTimer()
      setBarState("loading")
    }

    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [clearHideTimer])

  // Detect navigation completion via pathname change
  useEffect(() => {
    if (prevPathnameRef.current === pathname) return
    prevPathnameRef.current = pathname

    clearHideTimer()
    setBarState("completing")
    hideTimerRef.current = setTimeout(() => setBarState("idle"), 600)
  }, [pathname, clearHideTimer])

  if (barState === "idle") return null

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[9999] h-0.5 overflow-hidden pointer-events-none"
      aria-hidden
    >
      <div
        className={
          barState === "loading"
            ? "route-progress-bar-loading"
            : "route-progress-bar-completing"
        }
      />
    </div>
  )
}

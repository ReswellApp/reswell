"use client"

import { usePathname } from "next/navigation"
import { useLayoutEffect, useRef, useState } from "react"

/**
 * Scrolls to top and applies a CSS fade+slide entrance animation on client-side
 * navigations. `navCount` increments only on actual navigations (not initial load),
 * so the `page-enter` animation is skipped on first render to prevent FOIC.
 */
export function NavigationPageGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const prevPathRef = useRef<string | null>(null)
  const [navCount, setNavCount] = useState(0)

  useLayoutEffect(() => {
    if (prevPathRef.current === null) {
      prevPathRef.current = pathname
      return
    }
    if (prevPathRef.current === pathname) return
    prevPathRef.current = pathname

    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
    setNavCount((c) => c + 1)
  }, [pathname])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        key={navCount}
        className={
          navCount > 0
            ? "page-enter flex min-h-0 flex-1 flex-col"
            : "flex min-h-0 flex-1 flex-col"
        }
      >
        {children}
      </div>
    </div>
  )
}

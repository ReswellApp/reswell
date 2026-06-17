"use client"

import { usePathname } from "next/navigation"
import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { forceReleaseBodyScrollLock } from "@/hooks/use-body-scroll-lock"
import { scrollPageToTop } from "@/lib/utils/scroll-page-to-top"
import {
  cancelMessageThreadScrollBottom,
  isMessageThreadDetailRoute,
  isMobileMessageThreadViewport,
  scrollPageToMessageThreadBottom,
} from "@/lib/utils/message-thread-routes"

/**
 * Scrolls to top and applies a CSS fade+slide entrance animation on client-side
 * navigations. `navCount` increments only on actual navigations (not initial load),
 * so the `page-enter` animation is skipped on first render to prevent FOIC.
 */
export function NavigationPageGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const prevPathRef = useRef<string | null>(null)
  const [navCount, setNavCount] = useState(0)

  useLayoutEffect(() => {
    const isFirstLoad = prevPathRef.current === null
    if (isFirstLoad) {
      prevPathRef.current = pathname
    } else if (prevPathRef.current === pathname) {
      return
    } else {
      prevPathRef.current = pathname
    }

    forceReleaseBodyScrollLock()
    cancelMessageThreadScrollBottom()

    let cancelScrollBottom: (() => void) | undefined

    if (isMessageThreadDetailRoute(pathname) && isMobileMessageThreadViewport()) {
      cancelScrollBottom = scrollPageToMessageThreadBottom()
    } else {
      scrollPageToTop()
    }

    if (!isFirstLoad) {
      setNavCount((c) => c + 1)
    }

    return () => {
      cancelScrollBottom?.()
      cancelMessageThreadScrollBottom()
    }
  }, [pathname])

  return (
    <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div
        key={navCount}
        className={
          navCount > 0
            ? "page-enter flex w-full min-h-0 min-w-0 flex-1 flex-col"
            : "flex w-full min-h-0 min-w-0 flex-1 flex-col"
        }
      >
        {children}
      </div>
    </div>
  )
}

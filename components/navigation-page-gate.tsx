"use client"

import { usePathname } from "next/navigation"
import { useLayoutEffect, useRef, type ReactNode } from "react"
import { forceReleaseBodyScrollLock } from "@/hooks/use-body-scroll-lock"
import { scrollPageToTop } from "@/lib/utils/scroll-page-to-top"
import {
  cancelMessageThreadScrollBottom,
  isMessageThreadDetailRoute,
  isMessagesInboxIndexRoute,
  isMobileMessageThreadViewport,
  scrollPageToMessageThreadBottom,
} from "@/lib/utils/message-thread-routes"
import { useMobileLg } from "@/hooks/use-mobile-lg"
import { cn } from "@/lib/utils"

/**
 * Scrolls to the top on client-side navigations.
 *
 * Do not remount this subtree and do not fade or slide it in. Doing either
 * paints a white frame over listing photos that are already in memory —
 * back from a listing onto a category, and the same tiles on every other route.
 */
export function NavigationPageGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isMobileLg = useMobileLg()
  const flatMobileMessagesInbox = isMobileLg && isMessagesInboxIndexRoute(pathname)
  const prevPathRef = useRef<string | null>(null)

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

    return () => {
      cancelScrollBottom?.()
      cancelMessageThreadScrollBottom()
    }
  }, [pathname])

  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 flex-col",
        flatMobileMessagesInbox ? "flex-none" : "min-h-0 flex-1",
      )}
    >
      <div
        className={
          flatMobileMessagesInbox
            ? "flex w-full flex-col"
            : "flex w-full min-h-0 min-w-0 flex-1 flex-col"
        }
      >
        {children}
      </div>
    </div>
  )
}

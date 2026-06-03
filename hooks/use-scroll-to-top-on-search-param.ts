"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"
import { scrollPageToTop } from "@/lib/utils/scroll-page-to-top"

/**
 * Scrolls to the top when a URL search param changes (skips the initial mount).
 * Use for pagination (`page`) and similar in-page navigations.
 */
export function useScrollToTopOnSearchParam(param: string): void {
  const searchParams = useSearchParams()
  const value = searchParams.get(param)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    scrollPageToTop()
  }, [value])
}

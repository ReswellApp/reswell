"use client"

import { usePathname } from "next/navigation"

import { useDebouncedEffect } from "@/hooks/use-debounced-effect"
import { useClientSearchParams } from "@/hooks/use-client-search-params"
import { sendKlaviyoClientPageView } from "@/lib/analytics/klaviyo-client-page-view"
import { shouldTrackPublicPageView } from "@/lib/analytics/public-page-view"

/** Coalesce rapid client navigations (filter toggles, back/forward) into one beacon. */
const PAGE_VIEW_DEBOUNCE_MS = 800

/**
 * Sends a Klaviyo event on each App Router navigation (including first paint).
 * Skips `/admin` routes entirely.
 *
 * The site shell uses {@link MarketingPageViewTracker} instead so Klaviyo / Meta /
 * OpenAI share one pathname subscriber. This standalone tracker stays for reuse.
 */
export function KlaviyoPageViewTracker(): null {
  const pathname = usePathname()
  const searchParams = useClientSearchParams()
  const searchString = searchParams.toString()

  useDebouncedEffect(
    () => {
      if (!shouldTrackPublicPageView(pathname)) return
      sendKlaviyoClientPageView(pathname, searchString)
    },
    [pathname, searchString],
    PAGE_VIEW_DEBOUNCE_MS,
  )

  return null
}

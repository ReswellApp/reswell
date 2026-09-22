'use client'

import { usePathname } from 'next/navigation'
import { useRef } from 'react'

import { useClientSearchParams } from '@/hooks/use-client-search-params'
import { useDebouncedEffect } from '@/hooks/use-debounced-effect'
import { sendKlaviyoClientPageView } from '@/lib/analytics/klaviyo-client-page-view'
import { shouldTrackPublicPageView } from '@/lib/analytics/public-page-view'
import { sendMetaPixelPageView } from '@/lib/meta/pixel-events'
import { sendOpenAiAdsPageViewed } from '@/lib/openai-ads/pixel-events'

/** Coalesce rapid client navigations (filter toggles, back/forward) into one beacon. */
const PAGE_VIEW_DEBOUNCE_MS = 800

/**
 * Single App Router page-view subscriber for Klaviyo, Meta, and OpenAI Ads.
 * Klaviyo includes the first paint after this runtime mounts; Meta / OpenAI skip
 * that first tick because their base snippets already measure the full load.
 */
export function MarketingPageViewTracker(): null {
  const pathname = usePathname()
  const searchParams = useClientSearchParams()
  const searchString = searchParams.toString()
  const isFirstRender = useRef(true)

  useDebouncedEffect(
    () => {
      if (!shouldTrackPublicPageView(pathname)) return

      sendKlaviyoClientPageView(pathname, searchString)

      if (isFirstRender.current) {
        isFirstRender.current = false
        return
      }

      sendMetaPixelPageView()
      sendOpenAiAdsPageViewed()
    },
    [pathname, searchString],
    PAGE_VIEW_DEBOUNCE_MS,
  )

  return null
}

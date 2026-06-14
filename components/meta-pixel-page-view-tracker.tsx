'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useRef } from 'react'

import { useDebouncedEffect } from '@/hooks/use-debounced-effect'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

/** Coalesce rapid client navigations into one PageView call. */
const PAGE_VIEW_DEBOUNCE_MS = 800

/**
 * Fires Meta Pixel PageView on App Router client navigations. The base snippet in
 * {@link MetaPixel} already tracks the first full page load.
 */
export function MetaPixelPageViewTracker(): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams?.toString() ?? ''
  const isFirstRender = useRef(true)

  useDebouncedEffect(
    () => {
      if (!pathname || !pathname.startsWith('/')) return
      if (pathname === '/admin' || pathname.startsWith('/admin/')) return

      if (isFirstRender.current) {
        isFirstRender.current = false
        return
      }

      if (typeof window.fbq === 'function') {
        window.fbq('track', 'PageView')
      }
    },
    [pathname, searchString],
    PAGE_VIEW_DEBOUNCE_MS,
  )

  return null
}

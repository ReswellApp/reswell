'use client'

import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

/**
 * Read URL search params without opting into Next.js `useSearchParams()` Suspense.
 * Used in always-visible chrome (header) so navigation never replaces the full nav
 * with an empty Suspense fallback or leaves scroll-lock cleanup incomplete.
 */
export function useClientSearchParams(): URLSearchParams {
  const pathname = usePathname()
  const searchString = typeof window !== 'undefined' ? window.location.search : ''
  return useMemo(
    () => new URLSearchParams(searchString),
    [pathname, searchString],
  )
}

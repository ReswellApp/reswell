"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  boardsBrowseSearchParamsEqual,
  mutateBoardsBrowseSearchParams,
  type BoardsBrowseNavigateOptions,
} from "@/lib/utils/boards-browse-navigate"

type NavigateMutator = (params: URLSearchParams) => void

export type UseBoardsBrowseRouterOptions = {
  /** Wrap the navigation (e.g. a `useTransition` start fn) so the UI can stay responsive. */
  transitionStart?: (cb: () => void) => void
  /**
   * Params used as the mutation base and equality reference. Defaults to the live URL
   * params. Pass an optimistic copy so filter UI can update before the server-driven
   * navigation commits.
   */
  baseParams?: URLSearchParams
  /**
   * Called with the computed next params inside the transition, immediately before
   * `router.replace`. Use to apply an optimistic UI update that matches the pending URL.
   */
  onNavigate?: (next: URLSearchParams) => void
}

export function useBoardsBrowseRouter(options?: UseBoardsBrowseRouterOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { transitionStart, baseParams, onNavigate } = options ?? {}

  const navigate = useCallback(
    (mutate: NavigateMutator, navOptions?: BoardsBrowseNavigateOptions) => {
      const current = new URLSearchParams((baseParams ?? searchParams).toString())
      const next = mutateBoardsBrowseSearchParams(current, mutate, navOptions)
      if (!next || boardsBrowseSearchParamsEqual(next, current)) return
      const qs = next.toString()
      const run = () => {
        onNavigate?.(next)
        router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
      }
      if (transitionStart) transitionStart(run)
      else run()
    },
    [pathname, router, searchParams, baseParams, onNavigate, transitionStart],
  )

  return { navigate, pathname, searchParams }
}

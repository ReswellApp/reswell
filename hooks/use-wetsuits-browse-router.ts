"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  boardsBrowseSearchParamsEqual,
  mutateBoardsBrowseSearchParams,
  replaceBrowseSearchParams,
  type BoardsBrowseNavigateOptions,
} from "@/lib/utils/boards-browse-navigate"

type NavigateMutator = (params: URLSearchParams) => void

/** URL navigation for `/wetsuits` browse (same page-reset semantics as `/boards`). */
export function useWetsuitsBrowseRouter(transitionStart?: (cb: () => void) => void) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigate = useCallback(
    (mutate: NavigateMutator, options?: BoardsBrowseNavigateOptions) => {
      const current = new URLSearchParams(searchParams.toString())
      const next = mutateBoardsBrowseSearchParams(current, mutate, options)
      if (!next || boardsBrowseSearchParamsEqual(next, current)) return
      const run = () => replaceBrowseSearchParams(router, pathname, next, options)
      if (transitionStart) transitionStart(run)
      else run()
    },
    [pathname, router, searchParams, transitionStart],
  )

  return { navigate, pathname, searchParams }
}

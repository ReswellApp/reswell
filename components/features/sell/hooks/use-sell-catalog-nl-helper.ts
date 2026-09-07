"use client"

import * as React from "react"
import type { SellCatalogNlHelperResponse } from "@/lib/types/sell-catalog-nl-helper"
import type { SellCatalogSearchMatchTier } from "@/lib/types/sell-catalog-search"

const MIN_QUERY_LENGTH = 4

export type SellCatalogNlHelperState = {
  /** True while the AI helper request for the current query is in flight. */
  loading: boolean
  /** Helper response for the current query, or null (pending / skipped / stale). */
  data: SellCatalogNlHelperResponse | null
}

/**
 * Parallel AI helper for the `/sell` catalog search wall.
 *
 * Fires after the primary catalog search settles without exact matches —
 * never on the critical path. Aborts on query change/unmount; failures are
 * silent so the primary results always stand.
 */
export function useSellCatalogNlHelper(input: {
  query: string
  settled: boolean
  matchTier: SellCatalogSearchMatchTier
}): SellCatalogNlHelperState {
  const { query, settled, matchTier } = input
  const q = query.trim()

  const [state, setState] = React.useState<{
    forQuery: string
    loading: boolean
    data: SellCatalogNlHelperResponse | null
  }>({ forQuery: "", loading: false, data: null })
  const requestedForRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!settled || matchTier === "exact" || q.length < MIN_QUERY_LENGTH) return
    if (requestedForRef.current === q) return
    requestedForRef.current = q

    const controller = new AbortController()
    let active = true

    setState({ forQuery: q, loading: true, data: null })
    ;(async () => {
      try {
        const res = await fetch(
          `/api/sell/catalog-search/nl-helper?${new URLSearchParams({ q })}`,
          {
            signal: controller.signal,
            headers: { Accept: "application/json" },
            credentials: "same-origin",
          },
        )
        const body = (await res.json()) as SellCatalogNlHelperResponse
        if (!active) return
        setState({ forQuery: q, loading: false, data: body?.ok ? body : null })
      } catch {
        if (!active) return
        setState({ forQuery: q, loading: false, data: null })
      }
    })()

    return () => {
      active = false
      controller.abort()
    }
  }, [q, settled, matchTier])

  if (state.forQuery !== q) {
    return { loading: false, data: null }
  }
  return { loading: state.loading, data: state.data }
}

"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { NaturalLanguageSearchHint } from "@/components/features/search/natural-language-search-hint"
import type { RecentListing } from "@/components/recent-feed-client"
import {
  mergeNlHelperRefineIntoSearchParams,
  type MarketplaceNlHelperRefine,
} from "@/lib/utils/marketplace-nl-helper-refine"

export type NlHelperMatchPayload = {
  listings: RecentListing[]
  rankedIds: string[]
  dropIds: string[]
}

/**
 * Shows rules-applied chips immediately, then runs Gemini (AI Gateway) in parallel
 * to refine filters and rank additional title+catalog matches without blocking
 * first results paint.
 */
export function NaturalLanguageSearchHelper({
  query,
  searchParamsString,
  initialAppliedLabels,
  initialSummary,
  qualityEventId,
  onMatch,
  className,
}: {
  query: string
  /** Current page query string (no `?`), from the server render. */
  searchParamsString: string
  initialAppliedLabels?: string[]
  initialSummary?: string | null
  /** Search quality review id so the NL helper snapshot can be attached. */
  qualityEventId?: string | null
  onMatch?: (payload: NlHelperMatchPayload) => void
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const q = query.trim()

  const [appliedLabels, setAppliedLabels] = useState<string[]>(initialAppliedLabels ?? [])
  const [summary, setSummary] = useState<string | null | undefined>(initialSummary)
  const refinedForQuery = useRef<string | null>(null)
  const onMatchRef = useRef(onMatch)
  onMatchRef.current = onMatch

  useEffect(() => {
    setAppliedLabels(initialAppliedLabels ?? [])
    setSummary(initialSummary)
  }, [initialAppliedLabels, initialSummary, q])

  useEffect(() => {
    if (q.length < 2) return
    if (refinedForQuery.current === q) return

    const controller = new AbortController()
    const startedFor = q
    const paramsSnapshot = searchParamsString
    const surface = pathname === "/boards" || pathname.startsWith("/boards/") ? "boards" : "marketplace"

    void (async () => {
      try {
        const params = new URLSearchParams({ q, surface })
        if (qualityEventId) params.set("eventId", qualityEventId)
        const res = await fetch(`/api/search/nl-helper?${params.toString()}`, {
          signal: controller.signal,
          credentials: "same-origin",
        })
        if (!res.ok || controller.signal.aborted) return
        const data = (await res.json()) as {
          ok?: boolean
          skipped?: boolean
          appliedLabels?: string[]
          summary?: string
          refine?: MarketplaceNlHelperRefine
          rankedIds?: string[]
          dropIds?: string[]
          listings?: RecentListing[]
        }
        if (controller.signal.aborted || startedFor !== q) return

        if (data.appliedLabels?.length) {
          setAppliedLabels((prev) => {
            const merged = [...prev]
            const seen = new Set(prev.map((l) => l.toLowerCase()))
            for (const label of data.appliedLabels!) {
              const key = label.toLowerCase()
              if (seen.has(key)) continue
              seen.add(key)
              merged.push(label)
            }
            return merged
          })
        }
        if (data.summary?.trim()) setSummary(data.summary.trim())

        const listings = Array.isArray(data.listings) ? data.listings : []
        const rankedIds = Array.isArray(data.rankedIds) ? data.rankedIds : []
        const dropIds = Array.isArray(data.dropIds) ? data.dropIds : []
        if (listings.length > 0 || rankedIds.length > 0 || dropIds.length > 0) {
          onMatchRef.current?.({ listings, rankedIds, dropIds })
        }

        refinedForQuery.current = startedFor

        if (data.skipped || !data.refine) return
        if (surface !== "boards") return

        const current = new URLSearchParams(paramsSnapshot)
        const next = mergeNlHelperRefineIntoSearchParams(current, data.refine)
        if (!next) return

        const qs = next.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      } catch (err) {
        if (controller.signal.aborted) return
        console.error("[NaturalLanguageSearchHelper] failed:", err)
        refinedForQuery.current = startedFor
      }
    })()

    return () => controller.abort()
  }, [q, pathname, router, searchParamsString, qualityEventId])

  if (q.length < 2) return null

  return (
    <NaturalLanguageSearchHint
      className={className}
      query={q}
      appliedLabels={appliedLabels}
      summary={summary}
    />
  )
}

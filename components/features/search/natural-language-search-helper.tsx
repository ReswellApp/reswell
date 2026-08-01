"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { NaturalLanguageSearchHint } from "@/components/features/search/natural-language-search-hint"
import {
  mergeNlHelperRefineIntoSearchParams,
  type MarketplaceNlHelperRefine,
} from "@/lib/utils/marketplace-nl-helper-refine"

/**
 * Shows rules-applied chips immediately, then runs Gemini (AI Gateway) in parallel
 * to refine filters without blocking the first search results paint.
 */
export function NaturalLanguageSearchHelper({
  query,
  searchParamsString,
  initialAppliedLabels,
  initialSummary,
  className,
}: {
  query: string
  /** Current page query string (no `?`), from the server render. */
  searchParamsString: string
  initialAppliedLabels?: string[]
  initialSummary?: string | null
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const q = query.trim()

  const [appliedLabels, setAppliedLabels] = useState<string[]>(initialAppliedLabels ?? [])
  const [summary, setSummary] = useState<string | null | undefined>(initialSummary)
  const refinedForQuery = useRef<string | null>(null)

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

    void (async () => {
      try {
        const res = await fetch(`/api/search/nl-helper?q=${encodeURIComponent(q)}`, {
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

        if (data.skipped || !data.refine) {
          refinedForQuery.current = startedFor
          return
        }

        const current = new URLSearchParams(paramsSnapshot)
        const next = mergeNlHelperRefineIntoSearchParams(current, data.refine)
        refinedForQuery.current = startedFor
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
  }, [q, pathname, router, searchParamsString])

  if (q.length < 2) return null

  return (
    <NaturalLanguageSearchHint
      className={className}
      appliedLabels={appliedLabels}
      summary={summary}
    />
  )
}

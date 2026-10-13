import { useEffect, useState } from "react"
import { fetchSellCatalog } from "@/lib/api"
import type { MobileSellCatalogRow } from "@reswell/api-contract"

const DEBOUNCE_MS = 180

/** Catalog suggestions for a brand or model query. Empty until the query has two characters. */
export function useSellCatalogSuggest(query: string): {
  results: MobileSellCatalogRow[]
  searching: boolean
} {
  const [results, setResults] = useState<MobileSellCatalogRow[]>([])
  const [searching, setSearching] = useState(false)
  const trimmed = query.trim()

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      setSearching(true)
      fetchSellCatalog(trimmed)
        .then((data) => {
          if (!cancelled) setResults(data.results.slice(0, 6))
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed])

  return { results: trimmed.length < 2 ? [] : results, searching: trimmed.length < 2 ? false : searching }
}

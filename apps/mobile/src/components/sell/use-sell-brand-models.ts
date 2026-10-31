import { useEffect, useMemo, useState } from "react"
import { fetchSellBrandModels } from "@/lib/api"
import type { MobileSellCatalogRow } from "@reswell/api-contract"

const MODEL_SUBSTRING_MATCH_MIN_CHARS = 4

/** Same token/prefix filter as website `SurfboardModelCatalogInput`. */
function filterBrandModels(rows: MobileSellCatalogRow[], query: string): MobileSellCatalogRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows.slice(0, 40)

  return rows
    .filter((row) => {
      const name = (row.model_name ?? row.title).toLowerCase()
      const brand = row.brand_name.toLowerCase()
      const combo = `${brand} ${name}`
      const tokens = combo.split(/[\s\-'/.]+/).filter(Boolean)
      if (tokens.some((token) => token.startsWith(q) || token === q)) return true
      if (q.length >= MODEL_SUBSTRING_MATCH_MIN_CHARS) {
        return name.includes(q) || brand.includes(q) || combo.includes(q)
      }
      return false
    })
    .slice(0, 40)
}

/**
 * Loads catalog models for a directory brand id (website sell model picker).
 * Empty `brandId` clears the list — free-typed brands stay free-text.
 */
export function useSellBrandModels(brandId: string, modelQuery: string): {
  results: MobileSellCatalogRow[]
  loading: boolean
} {
  const [rows, setRows] = useState<MobileSellCatalogRow[]>([])
  const [loading, setLoading] = useState(false)
  const trimmedBrandId = brandId.trim()

  useEffect(() => {
    if (!trimmedBrandId) {
      setRows([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchSellBrandModels(trimmedBrandId)
      .then((data) => {
        if (!cancelled) setRows(data.results.filter((row) => row.kind === "model"))
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [trimmedBrandId])

  const results = useMemo(() => filterBrandModels(rows, modelQuery), [rows, modelQuery])

  return { results: trimmedBrandId ? results : [], loading: trimmedBrandId ? loading : false }
}

"use client"

import { useCallback, useMemo } from "react"
import { useFinsBrowseRouter } from "@/hooks/use-fins-browse-router"
import {
  FIN_FACET_PARAM_KEYS,
  finFacetSelectionsFromParams,
  hasAnyFinFacetSelection,
  type FinsBrowseFacetSelections,
} from "@/lib/fins-browse-facets"

const FACET_OWNED_KEYS = [
  ...Object.values(FIN_FACET_PARAM_KEYS),
  "brand",
  "minPrice",
  "maxPrice",
] as const

export type FinsFilterState = {
  searchParams: URLSearchParams
  selections: FinsBrowseFacetSelections
  brand: string
  minPrice: string
  maxPrice: string
  activeCount: number
  hasAnyActive: boolean
  toggleMulti: (key: string, value: string) => void
  setBrand: (brand: string) => void
  setPriceRange: (min: string | null, max: string | null) => void
  clearAll: () => void
}

export function useFinsFilterState(
  transitionStart?: (cb: () => void) => void,
): FinsFilterState {
  const { navigate, searchParams } = useFinsBrowseRouter(transitionStart)

  const selections = useMemo(
    () =>
      finFacetSelectionsFromParams({
        fin: searchParams.get(FIN_FACET_PARAM_KEYS.finSetup) ?? undefined,
        finSystem: searchParams.get(FIN_FACET_PARAM_KEYS.finSystem) ?? undefined,
        size: searchParams.get(FIN_FACET_PARAM_KEYS.size) ?? undefined,
        condition: searchParams.get(FIN_FACET_PARAM_KEYS.condition) ?? undefined,
      }),
    [searchParams],
  )

  const brand = searchParams.get("brand") ?? ""
  const minPrice = searchParams.get("minPrice") ?? ""
  const maxPrice = searchParams.get("maxPrice") ?? ""

  const toggleMulti = useCallback(
    (key: string, value: string) => {
      navigate((params) => {
        const current = (params.get(key) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value]
        if (next.length) params.set(key, next.join(","))
        else params.delete(key)
      })
    },
    [navigate],
  )

  const setBrand = useCallback(
    (nextBrand: string) => {
      navigate((params) => {
        const trimmed = nextBrand.trim()
        if (trimmed) params.set("brand", trimmed)
        else params.delete("brand")
      })
    },
    [navigate],
  )

  const setPriceRange = useCallback(
    (min: string | null, max: string | null) => {
      navigate((params) => {
        const normMin = (min ?? "").trim()
        const normMax = (max ?? "").trim()
        if (normMin) params.set("minPrice", normMin)
        else params.delete("minPrice")
        if (normMax) params.set("maxPrice", normMax)
        else params.delete("maxPrice")
      })
    },
    [navigate],
  )

  const clearAll = useCallback(() => {
    navigate((params) => {
      for (const key of FACET_OWNED_KEYS) params.delete(key)
    })
  }, [navigate])

  const facetActive = hasAnyFinFacetSelection(selections)
  const hasAnyActive =
    facetActive || !!brand.trim() || !!minPrice.trim() || !!maxPrice.trim()

  const activeCount =
    selections.finSetups.length +
    selections.finSystems.length +
    selections.sizes.length +
    selections.conditions.length +
    (brand.trim() ? 1 : 0) +
    (minPrice.trim() || maxPrice.trim() ? 1 : 0)

  return {
    searchParams,
    selections,
    brand,
    minPrice,
    maxPrice,
    activeCount,
    hasAnyActive,
    toggleMulti,
    setBrand,
    setPriceRange,
    clearAll,
  }
}

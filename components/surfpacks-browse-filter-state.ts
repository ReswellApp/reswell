"use client"

import { useCallback, useMemo } from "react"
import { useSurfpacksBrowseRouter } from "@/hooks/use-surfpacks-browse-router"
import {
  SURFPACK_FACET_PARAM_KEYS,
  surfpackFacetSelectionsFromParams,
  hasAnySurfpackFacetSelection,
  type SurfpacksBrowseFacetSelections,
} from "@/lib/surfpacks-browse-facets"

const FACET_OWNED_KEYS = [
  ...Object.values(SURFPACK_FACET_PARAM_KEYS),
  "brand",
  "minPrice",
  "maxPrice",
] as const

export type SurfpacksFilterState = {
  searchParams: URLSearchParams
  selections: SurfpacksBrowseFacetSelections
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

export function useSurfpacksFilterState(
  transitionStart?: (cb: () => void) => void,
): SurfpacksFilterState {
  const { navigate, searchParams } = useSurfpacksBrowseRouter(transitionStart)

  const selections = useMemo(
    () =>
      surfpackFacetSelectionsFromParams({
        size: searchParams.get(SURFPACK_FACET_PARAM_KEYS.size) ?? undefined,
        condition: searchParams.get(SURFPACK_FACET_PARAM_KEYS.condition) ?? undefined,
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

  const facetActive = hasAnySurfpackFacetSelection(selections)
  const hasAnyActive =
    facetActive || !!brand.trim() || !!minPrice.trim() || !!maxPrice.trim()

  const activeCount =
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

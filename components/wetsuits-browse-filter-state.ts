"use client"

import { useCallback, useMemo } from "react"
import { useWetsuitsBrowseRouter } from "@/hooks/use-wetsuits-browse-router"
import {
  WETSUIT_FACET_PARAM_KEYS,
  wetsuitFacetSelectionsFromParams,
  hasAnyWetsuitFacetSelection,
  type WetsuitsBrowseFacetSelections,
} from "@/lib/wetsuits-browse-facets"
import {
  browseFacetRangeValue,
  logBrowseFacetClick,
} from "@/lib/log-browse-button-click"

const FACET_OWNED_KEYS = [
  ...Object.values(WETSUIT_FACET_PARAM_KEYS),
  "brand",
  "minPrice",
  "maxPrice",
] as const

export type WetsuitsFilterState = {
  searchParams: URLSearchParams
  selections: WetsuitsBrowseFacetSelections
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

export function useWetsuitsFilterState(
  transitionStart?: (cb: () => void) => void,
): WetsuitsFilterState {
  const { navigate, searchParams } = useWetsuitsBrowseRouter(transitionStart)

  const selections = useMemo(
    () =>
      wetsuitFacetSelectionsFromParams({
        size: searchParams.get(WETSUIT_FACET_PARAM_KEYS.size) ?? undefined,
        condition: searchParams.get(WETSUIT_FACET_PARAM_KEYS.condition) ?? undefined,
      }),
    [searchParams],
  )

  const brand = searchParams.get("brand") ?? ""
  const minPrice = searchParams.get("minPrice") ?? ""
  const maxPrice = searchParams.get("maxPrice") ?? ""

  const toggleMulti = useCallback(
    (key: string, value: string) => {
      const current = (searchParams.get(key) ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      const selecting = !current.includes(value)
      logBrowseFacetClick({
        category: "wetsuits",
        facetKey: key,
        facetValue: value,
        detail: selecting ? "select" : "deselect",
      })
      navigate((params) => {
        const cur = (params.get(key) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        const next = cur.includes(value)
          ? cur.filter((v) => v !== value)
          : [...cur, value]
        if (next.length) params.set(key, next.join(","))
        else params.delete(key)
      })
    },
    [navigate, searchParams],
  )

  const setBrand = useCallback(
    (nextBrand: string) => {
      const trimmed = nextBrand.trim()
      logBrowseFacetClick({
        category: "wetsuits",
        facetKey: "brand",
        facetValue: trimmed || undefined,
        detail: trimmed ? "set" : "clear",
      })
      navigate((params) => {
        if (trimmed) params.set("brand", trimmed)
        else params.delete("brand")
      })
    },
    [navigate],
  )

  const setPriceRange = useCallback(
    (min: string | null, max: string | null) => {
      const range = browseFacetRangeValue(min, max)
      logBrowseFacetClick({
        category: "wetsuits",
        facetKey: "price",
        facetValue: range || undefined,
        detail: range ? "set" : "clear",
      })
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

  const facetActive = hasAnyWetsuitFacetSelection(selections)
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

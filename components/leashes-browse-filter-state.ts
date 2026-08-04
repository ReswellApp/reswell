"use client"

import { useCallback, useMemo } from "react"
import { useLeashesBrowseRouter } from "@/hooks/use-leashes-browse-router"
import {
  LEASH_FACET_PARAM_KEYS,
  leashFacetSelectionsFromParams,
  hasAnyLeashFacetSelection,
  type LeashesBrowseFacetSelections,
} from "@/lib/leashes-browse-facets"
import {
  browseFacetRangeValue,
  logBrowseFacetClick,
} from "@/lib/log-browse-button-click"

const FACET_OWNED_KEYS = [
  ...Object.values(LEASH_FACET_PARAM_KEYS),
  "brand",
  "minPrice",
  "maxPrice",
] as const

export type LeashesFilterState = {
  searchParams: URLSearchParams
  selections: LeashesBrowseFacetSelections
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

export function useLeashesFilterState(
  transitionStart?: (cb: () => void) => void,
): LeashesFilterState {
  const { navigate, searchParams } = useLeashesBrowseRouter(transitionStart)

  const selections = useMemo(
    () =>
      leashFacetSelectionsFromParams({
        size: searchParams.get(LEASH_FACET_PARAM_KEYS.size) ?? undefined,
        condition: searchParams.get(LEASH_FACET_PARAM_KEYS.condition) ?? undefined,
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
        category: "leashes",
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
        category: "leashes",
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
        category: "leashes",
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

  const facetActive = hasAnyLeashFacetSelection(selections)
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

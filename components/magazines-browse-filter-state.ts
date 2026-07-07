"use client"

import { useCallback, useMemo } from "react"
import { useMagazinesBrowseRouter } from "@/hooks/use-magazines-browse-router"
import {
  MAGAZINE_FACET_PARAM_KEYS,
  magazineFacetSelectionsFromParams,
  hasAnyMagazineFacetSelection,
  type MagazinesBrowseFacetSelections,
} from "@/lib/magazines-browse-facets"

const FACET_OWNED_KEYS = [
  ...Object.values(MAGAZINE_FACET_PARAM_KEYS),
  "brand",
  "minPrice",
  "maxPrice",
  "minYear",
  "maxYear",
] as const

export type MagazinesFilterState = {
  searchParams: URLSearchParams
  selections: MagazinesBrowseFacetSelections
  brand: string
  minPrice: string
  maxPrice: string
  minYear: string
  maxYear: string
  activeCount: number
  hasAnyActive: boolean
  toggleMulti: (key: string, value: string) => void
  setBrand: (brand: string) => void
  setPriceRange: (min: string | null, max: string | null) => void
  setYearRange: (min: string | null, max: string | null) => void
  clearAll: () => void
}

export function useMagazinesFilterState(
  transitionStart?: (cb: () => void) => void,
): MagazinesFilterState {
  const { navigate, searchParams } = useMagazinesBrowseRouter(transitionStart)

  const selections = useMemo(
    () =>
      magazineFacetSelectionsFromParams({
        condition: searchParams.get(MAGAZINE_FACET_PARAM_KEYS.condition) ?? undefined,
      }),
    [searchParams],
  )

  const brand = searchParams.get("brand") ?? ""
  const minPrice = searchParams.get("minPrice") ?? ""
  const maxPrice = searchParams.get("maxPrice") ?? ""
  const minYear = searchParams.get("minYear") ?? ""
  const maxYear = searchParams.get("maxYear") ?? ""

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

  const setYearRange = useCallback(
    (min: string | null, max: string | null) => {
      navigate((params) => {
        const normMin = (min ?? "").trim()
        const normMax = (max ?? "").trim()
        if (normMin) params.set("minYear", normMin)
        else params.delete("minYear")
        if (normMax) params.set("maxYear", normMax)
        else params.delete("maxYear")
      })
    },
    [navigate],
  )

  const clearAll = useCallback(() => {
    navigate((params) => {
      for (const key of FACET_OWNED_KEYS) params.delete(key)
    })
  }, [navigate])

  const facetActive = hasAnyMagazineFacetSelection(selections)
  const hasAnyActive =
    facetActive ||
    !!brand.trim() ||
    !!minPrice.trim() ||
    !!maxPrice.trim() ||
    !!minYear.trim() ||
    !!maxYear.trim()

  const activeCount =
    selections.conditions.length +
    (brand.trim() ? 1 : 0) +
    (minPrice.trim() || maxPrice.trim() ? 1 : 0) +
    (minYear.trim() || maxYear.trim() ? 1 : 0)

  return {
    searchParams,
    selections,
    brand,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    activeCount,
    hasAnyActive,
    toggleMulti,
    setBrand,
    setPriceRange,
    setYearRange,
    clearAll,
  }
}

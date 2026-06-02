"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  FACET_PARAM_KEYS,
  facetSelectionsFromParams,
  hasAnyFacetSelection,
  type BoardsBrowseFacetSelections,
} from "@/lib/boards-browse-facets"

/** Params owned by the facet sidebar/drawer (reset together on "Clear all"). */
const FACET_OWNED_KEYS = [
  ...Object.values(FACET_PARAM_KEYS),
  "brand",
  "brandId",
  "model",
  "brandModelId",
  "minPrice",
  "maxPrice",
] as const

type NavigateMutator = (params: URLSearchParams) => void

export type BoardsFilterState = {
  searchParams: URLSearchParams
  selections: BoardsBrowseFacetSelections
  brand: string
  model: string
  brandId: string
  brandModelId: string
  minPrice: string
  maxPrice: string
  /** Number of distinct active facet filters (for the "Filter" badge). */
  activeCount: number
  hasAnyActive: boolean
  toggleMulti: (key: string, value: string) => void
  setSingle: (key: string, value: string | null) => void
  setBrand: (next: { brand: string; brandId?: string; model?: string; brandModelId?: string }) => void
  setModel: (next: { model: string; brandModelId?: string }) => void
  setPriceRange: (min: string | null, max: string | null) => void
  clearKey: (key: string) => void
  clearAll: () => void
}

export function useBoardsFilterState(
  transitionStart?: (cb: () => void) => void,
): BoardsFilterState {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigate = useCallback(
    (mutate: NavigateMutator) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      params.delete("page")
      const qs = params.toString()
      const run = () =>
        router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
      if (transitionStart) transitionStart(run)
      else run()
    },
    [pathname, router, searchParams, transitionStart],
  )

  const selections = useMemo(
    () =>
      facetSelectionsFromParams({
        style: searchParams.get(FACET_PARAM_KEYS.style) ?? undefined,
        condition: searchParams.get(FACET_PARAM_KEYS.condition) ?? undefined,
        fin: searchParams.get(FACET_PARAM_KEYS.finSetup) ?? undefined,
        finSystem: searchParams.get(FACET_PARAM_KEYS.finSystem) ?? undefined,
        construction: searchParams.get(FACET_PARAM_KEYS.construction) ?? undefined,
        length: searchParams.get(FACET_PARAM_KEYS.length) ?? undefined,
        volume: searchParams.get(FACET_PARAM_KEYS.volume) ?? undefined,
      }),
    [searchParams],
  )

  const brand = searchParams.get("brand") ?? ""
  const brandId = searchParams.get("brandId") ?? ""
  const model = searchParams.get("model") ?? ""
  const brandModelId = searchParams.get("brandModelId") ?? ""
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

  const setSingle = useCallback(
    (key: string, value: string | null) => {
      navigate((params) => {
        if (value && value.trim()) params.set(key, value.trim())
        else params.delete(key)
      })
    },
    [navigate],
  )

  const setBrand = useCallback(
    (next: { brand: string; brandId?: string; model?: string; brandModelId?: string }) => {
      navigate((params) => {
        if (next.brand.trim()) params.set("brand", next.brand.trim())
        else params.delete("brand")
        if (next.brandId?.trim()) params.set("brandId", next.brandId.trim())
        else params.delete("brandId")
        // Picking/clearing a brand resets the model selection.
        if (next.model?.trim()) params.set("model", next.model.trim())
        else params.delete("model")
        if (next.brandModelId?.trim()) params.set("brandModelId", next.brandModelId.trim())
        else params.delete("brandModelId")
      })
    },
    [navigate],
  )

  const setModel = useCallback(
    (next: { model: string; brandModelId?: string }) => {
      navigate((params) => {
        if (next.model.trim()) params.set("model", next.model.trim())
        else params.delete("model")
        if (next.brandModelId?.trim()) params.set("brandModelId", next.brandModelId.trim())
        else params.delete("brandModelId")
      })
    },
    [navigate],
  )

  const setPriceRange = useCallback(
    (min: string | null, max: string | null) => {
      navigate((params) => {
        const minN = min?.trim() ? Math.round(Number(min)) : NaN
        const maxN = max?.trim() ? Math.round(Number(max)) : NaN
        if (Number.isFinite(minN) && minN >= 0) params.set("minPrice", String(minN))
        else params.delete("minPrice")
        if (Number.isFinite(maxN) && maxN >= 0) params.set("maxPrice", String(maxN))
        else params.delete("maxPrice")
      })
    },
    [navigate],
  )

  const clearKey = useCallback(
    (key: string) => {
      navigate((params) => params.delete(key))
    },
    [navigate],
  )

  const clearAll = useCallback(() => {
    navigate((params) => {
      for (const key of FACET_OWNED_KEYS) params.delete(key)
    })
  }, [navigate])

  const activeCount = useMemo(() => {
    let n = 0
    n += selections.styles.length
    n += selections.conditions.length
    n += selections.finSetups.length
    n += selections.finSystems.length
    n += selections.constructions.length
    n += selections.lengthBuckets.length
    n += selections.volumeBuckets.length
    if (brand.trim() || brandId.trim()) n += 1
    if (model.trim() || brandModelId.trim()) n += 1
    if (minPrice.trim() || maxPrice.trim()) n += 1
    return n
  }, [selections, brand, brandId, model, brandModelId, minPrice, maxPrice])

  return {
    searchParams,
    selections,
    brand,
    model,
    brandId,
    brandModelId,
    minPrice,
    maxPrice,
    activeCount,
    hasAnyActive:
      hasAnyFacetSelection(selections) ||
      Boolean(brand.trim() || brandId.trim() || model.trim() || brandModelId.trim() || minPrice.trim() || maxPrice.trim()),
    toggleMulti,
    setSingle,
    setBrand,
    setModel,
    setPriceRange,
    clearKey,
    clearAll,
  }
}

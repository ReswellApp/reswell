"use client"

import { useCallback, useMemo, useOptimistic } from "react"
import { useSearchParams } from "next/navigation"
import { useBoardsBrowseRouter } from "@/hooks/use-boards-browse-router"
import {
  FACET_PARAM_KEYS,
  facetSelectionsFromBrowseParams,
  hasAnyFacetSelection,
  type BoardsBrowseFacetSelections,
} from "@/lib/boards-browse-facets"
import {
  isBoardsBrowseShippingAvailableParam,
  normalizedBoardsBrowseTypeFromParam,
} from "@/lib/marketplace-slug-metadata"
import { normalizeBoardBrowseRadius } from "@/lib/boards-browse-location"
import {
  browseFacetRangeValue,
  logBrowseFacetClick,
} from "@/lib/log-browse-button-click"

/** Params owned by the facet sidebar/drawer (reset together on "Clear all"). */
const FACET_OWNED_KEYS = [
  ...Object.values(FACET_PARAM_KEYS),
  "type",
  "brand",
  "brandId",
  "model",
  "brandModelId",
  "minPrice",
  "maxPrice",
  "location",
  "lat",
  "lng",
  "radius",
  "shipping",
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
  location: string
  radius: string
  /** Seller offers shipping (`shipping=1`). */
  shippingAvailable: boolean
  /** Number of distinct active facet filters (for the "Filter" badge). */
  activeCount: number
  hasAnyActive: boolean
  toggleMulti: (key: string, value: string) => void
  setSingle: (key: string, value: string | null) => void
  setBrand: (next: { brand: string; brandId?: string; model?: string; brandModelId?: string }) => void
  setModel: (next: { model: string; brandModelId?: string }) => void
  setPriceRange: (min: string | null, max: string | null) => void
  setLocationQuery: (query: string) => void
  setLocationCoords: (label: string, lat: number, lng: number) => void
  setRadius: (value: string | null) => void
  setShippingAvailable: (on: boolean) => void
  clearKey: (key: string) => void
  clearAll: () => void
}

export function useBoardsFilterState(
  transitionStart?: (cb: () => void) => void,
): BoardsFilterState {
  const liveSearchParams = useSearchParams()

  // The selection UI (checkboxes, chips, count) is driven entirely by the URL, but a
  // filtered navigation keeps `useSearchParams()` pinned to the old URL until the server
  // finishes re-rendering. An optimistic mirror of the params flips instantly on click and
  // converges with the real URL once the navigation commits.
  const baseParams = useMemo(
    () => new URLSearchParams(liveSearchParams.toString()),
    [liveSearchParams],
  )
  const [searchParams, applyOptimisticParams] = useOptimistic(
    baseParams,
    (_prev: URLSearchParams, next: URLSearchParams) => next,
  )

  const { navigate } = useBoardsBrowseRouter({
    transitionStart,
    baseParams: searchParams,
    onNavigate: applyOptimisticParams,
  })

  const selections = useMemo(
    () =>
      facetSelectionsFromBrowseParams({
        type: searchParams.get("type") ?? undefined,
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
  const location = searchParams.get("location") ?? ""
  const radius = normalizeBoardBrowseRadius(searchParams.get("radius"))
  const shippingAvailable = isBoardsBrowseShippingAvailableParam(searchParams.get("shipping"))

  const toggleMulti = useCallback(
    (key: string, value: string) => {
      let selecting = true
      if (key === FACET_PARAM_KEYS.style) {
        const navType = normalizedBoardsBrowseTypeFromParam(searchParams.get("type"))
        let current = (searchParams.get(key) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        if (current.length === 0 && navType) current = [navType]
        selecting = !current.includes(value)
      } else {
        const current = (searchParams.get(key) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        selecting = !current.includes(value)
      }
      logBrowseFacetClick({
        category: "boards",
        facetKey: key,
        facetValue: value,
        detail: selecting ? "select" : "deselect",
      })

      navigate((params) => {
        if (key === FACET_PARAM_KEYS.style) {
          const navType = normalizedBoardsBrowseTypeFromParam(params.get("type"))
          let current = (params.get(key) ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
          if (current.length === 0 && navType) current = [navType]
          const next = current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value]
          params.delete("type")
          if (next.length) params.set(key, next.join(","))
          else params.delete(key)
          return
        }

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
    [navigate, searchParams],
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
      const trimmed = next.brand.trim()
      logBrowseFacetClick({
        category: "boards",
        facetKey: "brand",
        facetValue: trimmed || undefined,
        detail: trimmed ? "set" : "clear",
      })
      navigate((params) => {
        if (trimmed) params.set("brand", trimmed)
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
      const trimmed = next.model.trim()
      logBrowseFacetClick({
        category: "boards",
        facetKey: "model",
        facetValue: trimmed || undefined,
        detail: trimmed ? "set" : "clear",
      })
      navigate((params) => {
        if (trimmed) params.set("model", trimmed)
        else params.delete("model")
        if (next.brandModelId?.trim()) params.set("brandModelId", next.brandModelId.trim())
        else params.delete("brandModelId")
      })
    },
    [navigate],
  )

  const setPriceRange = useCallback(
    (min: string | null, max: string | null) => {
      const range = browseFacetRangeValue(min, max)
      logBrowseFacetClick({
        category: "boards",
        facetKey: "price",
        facetValue: range || undefined,
        detail: range ? "set" : "clear",
      })
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

  const setLocationQuery = useCallback(
    (query: string) => {
      const trimmed = query.trim()
      logBrowseFacetClick({
        category: "boards",
        facetKey: "location",
        facetValue: trimmed || undefined,
        detail: trimmed ? "set" : "clear",
      })
      navigate((params) => {
        if (trimmed) params.set("location", trimmed)
        else {
          params.delete("location")
          params.delete("lat")
          params.delete("lng")
          params.delete("radius")
        }
      })
    },
    [navigate],
  )

  const setLocationCoords = useCallback(
    (label: string, lat: number, lng: number) => {
      logBrowseFacetClick({
        category: "boards",
        facetKey: "location",
        facetValue: label.trim() || undefined,
        detail: "set",
      })
      navigate((params) => {
        params.set("location", label)
        params.set("lat", String(lat))
        params.set("lng", String(lng))
      })
    },
    [navigate],
  )

  const setRadius = useCallback(
    (value: string | null) => {
      const trimmed = value?.trim() ?? ""
      logBrowseFacetClick({
        category: "boards",
        facetKey: "radius",
        facetValue: trimmed || undefined,
        detail: trimmed ? "set" : "clear",
      })
      navigate((params) => {
        if (trimmed) params.set("radius", trimmed)
        else params.delete("radius")
      })
    },
    [navigate],
  )

  const setShippingAvailable = useCallback(
    (on: boolean) => {
      // Toolbar "Ship to me" is tracked separately as button=ship_to_me.
      navigate((params) => {
        if (on) params.set("shipping", "1")
        else params.delete("shipping")
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
    if (location.trim()) n += 1
    if (radius !== "any") n += 1
    if (shippingAvailable) n += 1
    return n
  }, [
    selections,
    brand,
    brandId,
    model,
    brandModelId,
    minPrice,
    maxPrice,
    location,
    radius,
    shippingAvailable,
  ])

  return {
    searchParams,
    selections,
    brand,
    model,
    brandId,
    brandModelId,
    minPrice,
    maxPrice,
    location,
    radius,
    shippingAvailable,
    activeCount,
    hasAnyActive:
      hasAnyFacetSelection(selections) ||
      Boolean(
        brand.trim() ||
          brandId.trim() ||
          model.trim() ||
          brandModelId.trim() ||
          minPrice.trim() ||
          maxPrice.trim() ||
          location.trim() ||
          radius !== "any" ||
          shippingAvailable,
      ),
    toggleMulti,
    setSingle,
    setBrand,
    setModel,
    setPriceRange,
    setLocationQuery,
    setLocationCoords,
    setRadius,
    setShippingAvailable,
    clearKey,
    clearAll,
  }
}

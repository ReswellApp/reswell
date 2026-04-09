"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"
import type { AddressFields } from "./address-fields"

export type GeocodeSuggestionRow = {
  label: string
  lat: number
  lng: number
  city?: string
  state?: string
}

async function fetchStructured(lat: number, lng: number) {
  const res = await fetch(
    `/api/geocode/structured?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
  )
  if (!res.ok) return null
  return (await res.json()) as {
    address_line1: string | null
    city_locality: string | null
    state_province: string | null
    postal_code: string | null
    country_code: string
  }
}

function buildPatch(
  structured: Awaited<ReturnType<typeof fetchStructured>>,
  s: GeocodeSuggestionRow,
): Partial<AddressFields> {
  const patch: Partial<AddressFields> = {}
  if (structured) {
    if (structured.address_line1) patch.address_line1 = structured.address_line1
    if (structured.city_locality) patch.city_locality = structured.city_locality
    if (structured.state_province) patch.state_province = structured.state_province
    if (structured.postal_code) patch.postal_code = structured.postal_code
    if (structured.country_code) patch.country_code = structured.country_code
  }
  if (!patch.city_locality && s.city) patch.city_locality = s.city
  if (!patch.state_province && s.state) patch.state_province = s.state
  const cc = patch.country_code ?? structured?.country_code ?? "US"
  if (patch.state_province) {
    patch.state_province = normalizeUsStateProvinceForShipping(cc, patch.state_province)
  }
  return patch
}

export function useGeocodeAddressSuggest(
  query: string,
  onApply: (patch: Partial<AddressFields>) => void,
  options?: {
    minLength?: number
    debounceMs?: number
    enabled?: boolean
    /** When true (default), request street-level suggestions from /api/geocode/suggest. */
    detailFull?: boolean
  },
) {
  const minLength = options?.minLength ?? 2
  const debounceMs = options?.debounceMs ?? 220
  const enabled = options?.enabled ?? true
  const detailFull = options?.detailFull ?? true

  const [rows, setRows] = useState<GeocodeSuggestionRow[]>([])
  const [open, setOpen] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    if (!enabled) return
    const t = query.trim()
    if (t.length < minLength) {
      setRows([])
      setOpen(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setSuggestLoading(true)
      void (async () => {
        try {
          const detailParam = detailFull ? "&detail=full" : ""
          const res = await fetch(
            `/api/geocode/suggest?q=${encodeURIComponent(t)}${detailParam}`,
            { signal: ac.signal },
          )
          if (!res.ok) {
            setRows([])
            return
          }
          const data = (await res.json()) as { suggestions?: GeocodeSuggestionRow[] }
          const list = Array.isArray(data.suggestions) ? data.suggestions : []
          setRows(list)
          setActive(list.length > 0 ? 0 : -1)
          setOpen(list.length > 0)
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return
          setRows([])
        } finally {
          setSuggestLoading(false)
        }
      })()
    }, debounceMs)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, minLength, debounceMs, enabled, detailFull])

  const onApplyRef = useRef(onApply)
  onApplyRef.current = onApply

  const pick = useCallback(async (s: GeocodeSuggestionRow) => {
    setOpen(false)
    setRows([])
    setActive(-1)
    setResolving(true)
    try {
      const structured = await fetchStructured(s.lat, s.lng)
      onApplyRef.current(buildPatch(structured, s))
    } finally {
      setResolving(false)
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open || rows.length === 0) {
        if (e.key === "Escape") setOpen(false)
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setOpen(true)
        setActive((i) => Math.min(i + 1, rows.length - 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === "Home") {
        e.preventDefault()
        setActive(0)
        return
      }
      if (e.key === "End") {
        e.preventDefault()
        setActive(rows.length - 1)
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        const i = activeRef.current
        if (i >= 0 && rows[i]) void pick(rows[i])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
        return
      }
      if (e.key === "Tab") {
        setOpen(false)
      }
    },
    [open, rows, pick],
  )

  return {
    rows,
    open,
    setOpen,
    suggestLoading,
    resolving,
    active,
    setActive,
    pick,
    handleKeyDown,
  }
}

"use client"

import { useEffect, useId, useRef, useState, useCallback } from "react"
import type { KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"
import type { AddressFields } from "./address-fields"
import { useGeocodeAddressSuggest, type GeocodeSuggestionRow } from "./geocode-address-suggest"
import {
  GooglePlacesAddressInput,
  type GoogleResolvedAddress,
} from "@/components/features/checkout/google-places-address-input"

const HAS_GOOGLE_KEY = Boolean(
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim(),
)

function googleResolvedToPatch(a: GoogleResolvedAddress): Partial<AddressFields> {
  const cc = (a.country || "US").slice(0, 2).toUpperCase()
  return {
    address_line1: a.line1,
    address_line2: a.line2,
    city_locality: a.city,
    state_province: normalizeUsStateProvinceForShipping(cc, a.state),
    postal_code: a.postal_code,
    country_code: cc,
  }
}

function SuggestListbox({
  id,
  rows,
  active,
  onPick,
  onHover,
}: {
  id: string
  rows: GeocodeSuggestionRow[]
  active: number
  onPick: (r: GeocodeSuggestionRow) => void
  onHover: (index: number) => void
}) {
  if (rows.length === 0) return null
  return (
    <ul
      id={id}
      role="listbox"
      className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-xl border border-border/60 bg-popover py-1 text-[13px] shadow-lg shadow-black/10"
    >
      {rows.map((r, i) => (
        <li
          key={`${r.label}-${r.lat}-${r.lng}-${i}`}
          role="option"
          aria-selected={i === active}
          id={`${id}-opt-${i}`}
        >
          <button
            type="button"
            className={cn(
              "flex w-full px-3 py-2.5 text-left transition-colors outline-none",
              i === active ? "bg-muted/80" : "hover:bg-muted/50",
            )}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onHover(i)}
            onClick={() => onPick(r)}
          >
            {r.label}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Address line 1 — Google Places when configured; otherwise OSM-backed suggestions. */
export function AddressLine1Suggest({
  value,
  onChange,
  onApplyPatch,
  inputClassName,
  disabled,
  inputId,
}: {
  value: string
  onChange: (line1: string) => void
  onApplyPatch: (patch: Partial<AddressFields>) => void
  inputClassName: string
  disabled?: boolean
  /** Stable id for label association (e.g. ship-from-line1) */
  inputId: string
}) {
  const genId = useId()
  const listId = `${genId}-line1-list`
  const hintId = `${inputId}-kbd-hint`
  const containerRef = useRef<HTMLDivElement>(null)
  const [useOsmFallback, setUseOsmFallback] = useState(!HAS_GOOGLE_KEY)

  const onGoogleResolved = useCallback(
    (a: GoogleResolvedAddress) => {
      onApplyPatch(googleResolvedToPatch(a))
    },
    [onApplyPatch],
  )

  const onGoogleFail = useCallback(() => {
    setUseOsmFallback(true)
  }, [])

  const { rows, open, setOpen, suggestLoading, resolving, active, setActive, pick, handleKeyDown } =
    useGeocodeAddressSuggest(value, onApplyPatch, { enabled: !disabled && useOsmFallback })

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [setOpen])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && rows.length > 0 && !open) {
      e.preventDefault()
      setOpen(true)
      setActive(0)
      return
    }
    handleKeyDown(e)
  }

  if (!useOsmFallback) {
    return (
      <div className="relative space-y-1.5 sm:col-span-2">
        <Label htmlFor={inputId} className="text-[12px] font-medium text-muted-foreground">
          Address line 1
        </Label>
        <GooglePlacesAddressInput
          id={inputId}
          name="address-line1"
          listboxId={`${genId}-admin-google-places-line1`}
          value={value}
          onChange={onChange}
          onAddressResolved={onGoogleResolved}
          onProviderError={onGoogleFail}
          placeholder="Street number and name"
          inputClassName={cn(inputClassName, "text-[13px]")}
          disabled={disabled}
        />
        <p id={hintId} className="text-[10px] text-muted-foreground/75">
          Choose a suggestion to fill city, state, and ZIP — or type manually.
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative space-y-1.5 sm:col-span-2">
      <Label htmlFor={inputId} className="text-[12px] font-medium text-muted-foreground">
        Address line 1
      </Label>
      <div className="relative">
        <Input
          id={inputId}
          value={value}
          disabled={disabled || resolving}
          autoComplete="off"
          placeholder="Start typing — suggestions appear below"
          className={cn(inputClassName, "pr-9 text-[13px]")}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => rows.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${listId}-opt-${active}` : undefined}
          aria-autocomplete="list"
          aria-describedby={hintId}
          role="combobox"
        />
        {resolving || suggestLoading ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
        {open && rows.length > 0 ? (
          <SuggestListbox
            id={listId}
            rows={rows}
            active={active}
            onPick={(r) => void pick(r)}
            onHover={setActive}
          />
        ) : null}
      </div>
      <p id={hintId} className="text-[10px] text-muted-foreground/75">
        ↑↓ Home End · Enter to apply · Esc to close
      </p>
    </div>
  )
}

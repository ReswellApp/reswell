"use client"

import { LocationInputSuggest, type LocationSuggestion } from "@/components/location-input-suggest"
import type { ShipperTripPlace } from "@/lib/utils/shipperTripStops"
import { Button } from "@/components/ui/button"

export type ShipperCityPlace = ShipperTripPlace

export type ShipperCitySlot = {
  key: string
  query: string
  place: ShipperCityPlace | null
}

export function blankCitySlot(key: string): ShipperCitySlot {
  return { key, query: "", place: null }
}

export function placeFromSuggestion(suggestion: LocationSuggestion): ShipperCityPlace | null {
  const city = suggestion.city?.trim() || suggestion.label.split(",")[0]?.trim() || ""
  if (!city || !Number.isFinite(suggestion.lat) || !Number.isFinite(suggestion.lng)) return null
  const state = suggestion.state?.trim() || null
  const label = state ? `${city}, ${state}` : city
  return { city, state, latitude: suggestion.lat, longitude: suggestion.lng, label }
}

interface ShipperTripStopsProps {
  from: ShipperCitySlot
  middles: ShipperCitySlot[]
  to: ShipperCitySlot
  disabled: boolean
  canAdd: boolean
  onFrom: (slot: ShipperCitySlot) => void
  onMiddle: (slot: ShipperCitySlot) => void
  onRemoveMiddle: (key: string) => void
  onTo: (slot: ShipperCitySlot) => void
  onAdd: () => void
}

export function ShipperTripStops({
  from,
  middles,
  to,
  disabled,
  canAdd,
  onFrom,
  onMiddle,
  onRemoveMiddle,
  onTo,
  onAdd,
}: ShipperTripStopsProps) {
  const labels = [from, ...middles, to].flatMap((slot) => (slot.place ? [slot.place.label] : []))

  return (
    <div className="space-y-3 border-t border-border/70 pt-4">
      <CityField label="From" slot={from} disabled={disabled} onChange={onFrom} />
      {middles.map((slot, index) => (
        <div key={slot.key} className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <CityField label={`Stop ${index + 1}`} slot={slot} disabled={disabled} onChange={onMiddle} />
          </div>
          <button
            type="button"
            className="mb-2 shrink-0 text-sm underline"
            disabled={disabled}
            onClick={() => onRemoveMiddle(slot.key)}
          >
            Remove
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={disabled || !canAdd} onClick={onAdd}>
        Add stop
      </Button>
      <CityField label="To" slot={to} disabled={disabled} onChange={onTo} />
      <p className="text-sm text-muted-foreground">
        {labels.length >= 2 ? labels.join(" · ") : "Pick a From city and a To city. Add stops in the order you drive."}
      </p>
    </div>
  )
}

function CityField({
  label,
  slot,
  disabled,
  onChange,
}: {
  label: string
  slot: ShipperCitySlot
  disabled: boolean
  onChange: (slot: ShipperCitySlot) => void
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <LocationInputSuggest
        name={`shipper-city-${slot.key}`}
        listboxId={`shipper-city-${slot.key}-list`}
        aria-label={label}
        placeholder="City"
        suggestMode="location"
        value={slot.query}
        disabled={disabled}
        inputClassName="h-10"
        onChange={(query) => onChange({ ...slot, query, place: null })}
        onPickSuggestion={(suggestion) => {
          const place = placeFromSuggestion(suggestion)
          if (!place) return
          onChange({ ...slot, query: place.label, place })
        }}
      />
    </label>
  )
}

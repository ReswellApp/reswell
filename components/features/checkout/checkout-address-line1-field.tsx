"use client"

import { useCallback, useState } from "react"
import { LocationInputSuggest } from "@/components/location-input-suggest"
import { GooglePlacesAddressInput, type GoogleResolvedAddress } from "./google-places-address-input"

const HAS_GOOGLE_KEY = Boolean(
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim(),
)

type StructuredGeocodeAddress = {
  address_line1: string | null
  city_locality: string | null
  state_province: string | null
  postal_code: string | null
  country_code: string
}

export type ResolvedCheckoutAddress = {
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
}

interface CheckoutAddressLine1FieldProps {
  id?: string
  name?: string
  listboxId?: string
  value: string
  onChange: (line1: string) => void
  /** Called when the user selects a suggestion (Google Places or OSM + structured reverse geocode). */
  onAddressResolved: (address: ResolvedCheckoutAddress) => void
  inputClassName?: string
  placeholder?: string
  debounceMs?: number
}

function line1FromSuggestionLabel(label: string) {
  return label.split(",")[0]?.trim() ?? label
}

export function CheckoutAddressLine1Field({
  id,
  name = "address-line1",
  listboxId = "checkout-address-line1-suggest",
  value,
  onChange,
  onAddressResolved,
  inputClassName = "",
  placeholder = "Street number and name",
  debounceMs = 150,
}: CheckoutAddressLine1FieldProps) {
  const [useOsmFallback, setUseOsmFallback] = useState(!HAS_GOOGLE_KEY)

  const onGoogleFail = useCallback(() => {
    setUseOsmFallback(true)
  }, [])

  if (useOsmFallback) {
    return (
      <LocationInputSuggest
        id={id}
        name={name}
        listboxId={listboxId}
        suggestMode="address"
        pickSetsInputValue={false}
        debounceMs={debounceMs}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onPickSuggestion={async (place) => {
          try {
            const res = await fetch(
              `/api/geocode/structured?lat=${encodeURIComponent(place.lat)}&lng=${encodeURIComponent(place.lng)}`,
            )
            if (!res.ok) {
              onAddressResolved({
                line1: line1FromSuggestionLabel(place.label),
                line2: "",
                city: "",
                state: "",
                postal_code: "",
                country: "US",
              })
              return
            }
            const data = (await res.json()) as StructuredGeocodeAddress | { error?: string }
            if ("error" in data && data.error) {
              onAddressResolved({
                line1: line1FromSuggestionLabel(place.label),
                line2: "",
                city: "",
                state: "",
                postal_code: "",
                country: "US",
              })
              return
            }
            const s = data as StructuredGeocodeAddress
            onAddressResolved({
              line1: s.address_line1?.trim() || line1FromSuggestionLabel(place.label),
              line2: "",
              city: s.city_locality?.trim() ?? "",
              state: s.state_province?.trim() ?? "",
              postal_code: s.postal_code?.trim() ?? "",
              country: (s.country_code?.trim() || "US").slice(0, 2).toUpperCase(),
            })
          } catch {
            onAddressResolved({
              line1: line1FromSuggestionLabel(place.label),
              line2: "",
              city: "",
              state: "",
              postal_code: "",
              country: "US",
            })
          }
        }}
        inputClassName={inputClassName}
      />
    )
  }

  const mapGoogle = useCallback(
    (a: GoogleResolvedAddress) => {
      onAddressResolved({
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        state: a.state,
        postal_code: a.postal_code,
        country: a.country,
      })
    },
    [onAddressResolved],
  )

  return (
    <GooglePlacesAddressInput
      id={id}
      name={name}
      listboxId={listboxId}
      value={value}
      onChange={onChange}
      onAddressResolved={mapGoogle}
      onProviderError={onGoogleFail}
      placeholder={placeholder}
      inputClassName={inputClassName}
      debounceMs={debounceMs}
    />
  )
}

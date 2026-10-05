"use client"

import { useState } from "react"

import { GooglePlacesAddressInput } from "@/components/features/checkout/google-places-address-input"
import { Input } from "@/components/ui/input"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { isCaliforniaAddressState } from "@/lib/services/surfboardShipped"

export type SurfboardShippedPickupForm = {
  full_name: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
  google_place_id: string
  latitude: number | null
  longitude: number | null
  formatted_address: string
}

export function SurfboardShippedPickupFields({
  form,
  saved,
  onPick,
  onChange,
}: {
  form: SurfboardShippedPickupForm
  saved: ProfileAddressRow[]
  onPick: (row: ProfileAddressRow) => void
  onChange: (next: SurfboardShippedPickupForm) => void
}) {
  const [lookupUnavailable, setLookupUnavailable] = useState(false)
  const placed = Boolean(form.google_place_id)
  const outsideCalifornia = placed && !isCaliforniaAddressState(form.state)

  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs font-semibold text-foreground sm:text-sm">Pickup name, phone, and address</p>
      <p className="text-xs leading-snug text-muted-foreground">
        Search the street with Google. Any California street works, including Los Angeles and Oakland.
      </p>
      {saved.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {saved.map((row) => (
            <button
              key={row.id}
              type="button"
              className="rounded-md border border-border px-2 py-1 text-left text-xs hover:border-foreground"
              onClick={() => onPick(row)}
            >
              {row.full_name} · {row.city}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          aria-label="Pickup name"
          placeholder="Name"
          value={form.full_name}
          onChange={(event) => onChange({ ...form, full_name: event.target.value })}
        />
        <Input
          aria-label="Pickup phone"
          placeholder="Phone"
          value={form.phone}
          onChange={(event) => onChange({ ...form, phone: event.target.value })}
        />
      </div>
      <GooglePlacesAddressInput
        id="surfboard-shipped-line1"
        value={form.line1}
        onChange={(line1) =>
          onChange({
            ...form,
            line1,
            google_place_id: "",
            latitude: null,
            longitude: null,
            formatted_address: "",
          })
        }
        onFullPlaceResolved={(place) =>
          onChange({
            ...form,
            line1: place.address.line1,
            line2: place.address.line2,
            city: place.address.city,
            state: place.address.state,
            postal_code: place.address.postal_code,
            country: "US",
            google_place_id: place.placeId,
            latitude: place.latitude,
            longitude: place.longitude,
            formatted_address: place.formattedAddress,
          })
        }
        onProviderError={() => setLookupUnavailable(true)}
        placeholder="Search the pickup street"
      />
      {lookupUnavailable ? (
        <p className="text-xs text-amber-700">Address search is unavailable. Try the search again.</p>
      ) : null}
      {form.formatted_address ? (
        <p className="text-xs text-foreground">{form.formatted_address}</p>
      ) : (
        <p className="text-xs text-muted-foreground">Pick a Google result so the street is exact.</p>
      )}
      {outsideCalifornia ? (
        <p className="text-xs text-amber-700">Google places this address outside California.</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Input aria-label="Pickup city" placeholder="City" value={form.city} readOnly />
        <Input aria-label="Pickup state" placeholder="CA" value={form.state} readOnly />
        <Input aria-label="Pickup ZIP" placeholder="ZIP" value={form.postal_code} readOnly />
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"

import { GooglePlacesAddressInput } from "@/components/features/checkout/google-places-address-input"
import type { SurfboardShippedPickupForm } from "@/components/features/sell/surfboard-shipped-pickup-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isCaliforniaAddressState } from "@/lib/services/surfboardShipped"

const EMPTY_PICKUP: SurfboardShippedPickupForm = {
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "CA",
  postal_code: "",
  country: "US",
  google_place_id: "",
  latitude: null,
  longitude: null,
  formatted_address: "",
}

export function SurfboardShippedAddPickup({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: (next: SurfboardShippedPickupForm) => void
}) {
  const [form, setForm] = useState<SurfboardShippedPickupForm>(EMPTY_PICKUP)
  const [lookupUnavailable, setLookupUnavailable] = useState(false)
  const placed = Boolean(form.google_place_id)
  const outsideCalifornia = placed && !isCaliforniaAddressState(form.state)
  const ready = Boolean(
    placed &&
      !outsideCalifornia &&
      form.full_name.trim() &&
      form.phone.trim() &&
      form.line1.trim() &&
      form.city.trim() &&
      form.postal_code.trim(),
  )

  return (
    <div className="space-y-3">
      <div className="space-y-1 pr-6">
        <p className="text-xs font-semibold text-foreground sm:text-sm">Add address</p>
        <p className="text-xs leading-snug text-muted-foreground">
          Search the street with Google. Any California street works, including Los Angeles and Oakland.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          aria-label="Pickup name"
          placeholder="Name"
          value={form.full_name}
          onChange={(event) => setForm({ ...form, full_name: event.target.value })}
        />
        <Input
          aria-label="Pickup phone"
          placeholder="Phone"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
      </div>
      <GooglePlacesAddressInput
        id="surfboard-shipped-line1"
        value={form.line1}
        onChange={(line1) =>
          setForm({
            ...form,
            line1,
            google_place_id: "",
            latitude: null,
            longitude: null,
            formatted_address: "",
          })
        }
        onFullPlaceResolved={(place) =>
          setForm({
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
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={!ready} onClick={() => onConfirm(form)}>
          Use this address
        </Button>
      </div>
    </div>
  )
}

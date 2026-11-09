"use client"

import { useRef, useState, type ReactNode } from "react"

import {
  blankCitySlot,
  ShipperTripStops,
  type ShipperCitySlot,
} from "@/components/features/dashboard/shipper/shipper-trip-stops"
import { ShipperTripWindowFields } from "@/components/features/dashboard/shipper/shipper-trip-window"
import { appendShipperSlot, orderedShipperPlaces, removeShipperSlot } from "@/lib/utils/shipperTripStops"
import {
  clampShipperTripWindow,
  shipperTripDescriptionError,
  shipperTripWindowError,
  type ShipperTripWindow,
} from "@/lib/utils/shipperTripWindow"
import type { CoastalDirection } from "@/lib/types/coastal-delivery"
import { Button } from "@/components/ui/button"

export type ShipperTripCityPayload = {
  city: string
  state: string | null
  latitude: number
  longitude: number
}

export type ShipperTripSavePayload = ShipperTripWindow & {
  stops: ShipperTripCityPayload[]
  pickupDescription: string
  deliveryDescription: string
}

interface ShipperTripFormProps {
  direction: CoastalDirection
  pending: boolean
  previewing: boolean
  repeating: boolean
  weekLabel: string
  error: string | null
  onDirection: (direction: CoastalDirection) => void
  onSave: (trip: ShipperTripSavePayload) => void
}

export function ShipperTripForm({
  direction,
  pending,
  previewing,
  repeating,
  weekLabel,
  error,
  onDirection,
  onSave,
}: ShipperTripFormProps) {
  const nextKey = useRef(1)
  const [from, setFrom] = useState(() => blankCitySlot("from"))
  const [to, setTo] = useState(() => blankCitySlot("to"))
  const [middles, setMiddles] = useState<ShipperCitySlot[]>([])
  const [tripWindow, setTripWindow] = useState<ShipperTripWindow>({
    pickupStart: 2,
    pickupEnd: 2,
    deliveryStart: 2,
    deliveryEnd: 2,
  })
  const [pickupDescription, setPickupDescription] = useState("")
  const [deliveryDescription, setDeliveryDescription] = useState("")
  const places = orderedShipperPlaces([from, ...middles, to])
  const disabled = pending || previewing
  const windowError = shipperTripWindowError(tripWindow)
  const descriptionError = shipperTripDescriptionError(pickupDescription, deliveryDescription)
  const showDescriptionError = Boolean(
    (pickupDescription.trim() || deliveryDescription.trim()) && descriptionError,
  )

  function addStop() {
    nextKey.current += 1
    setMiddles((current) => appendShipperSlot(current, blankCitySlot(`stop-${nextKey.current}`)))
  }

  function save() {
    if (!places || disabled || windowError || descriptionError) return
    onSave({
      ...tripWindow,
      stops: places.map(({ city, state, latitude, longitude }) => ({ city, state, latitude, longitude })),
      pickupDescription: pickupDescription.trim(),
      deliveryDescription: deliveryDescription.trim(),
    })
  }

  return (
    <>
      <Field label="Direction">
        <select
          className={fieldClass}
          value={direction}
          onChange={(event) => onDirection(event.target.value as CoastalDirection)}
        >
          <option value="northbound">Northbound</option>
          <option value="southbound">Southbound</option>
        </select>
      </Field>
      <ShipperTripWindowFields
        tripWindow={tripWindow}
        pickupDescription={pickupDescription}
        deliveryDescription={deliveryDescription}
        disabled={disabled}
        onWindow={(next) => setTripWindow(clampShipperTripWindow(next))}
        onPickupDescription={setPickupDescription}
        onDeliveryDescription={setDeliveryDescription}
      />
      <ShipperTripStops
        from={from}
        middles={middles}
        to={to}
        disabled={disabled}
        canAdd={middles.length < 18}
        onFrom={setFrom}
        onMiddle={(slot) => setMiddles((current) => current.map((item) => (item.key === slot.key ? slot : item)))}
        onRemoveMiddle={(key) => setMiddles((current) => removeShipperSlot(current, key))}
        onTo={setTo}
        onAdd={addStop}
      />
      {windowError || showDescriptionError || error ? (
        <p className="text-sm text-destructive">{windowError || (showDescriptionError ? descriptionError : null) || error}</p>
      ) : null}
      <Button type="button" disabled={disabled || !places || Boolean(windowError || descriptionError)} onClick={save}>
        {pending ? "Saving…" : repeating ? "Add weekly trip" : `Add trip for ${weekLabel}`}
      </Button>
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

const fieldClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

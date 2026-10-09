"use client"

import { useRef, useState, type ReactNode } from "react"

import {
  blankCitySlot,
  ShipperTripStops,
  type ShipperCitySlot,
} from "@/components/features/dashboard/shipper/shipper-trip-stops"
import { appendShipperSlot, orderedShipperPlaces, removeShipperSlot } from "@/lib/utils/shipperTripStops"
import { COASTAL_WEEKDAY_LABELS, type CoastalDirection } from "@/lib/types/coastal-delivery"
import { Button } from "@/components/ui/button"

export type ShipperTripCityPayload = {
  city: string
  state: string | null
  latitude: number
  longitude: number
}

interface ShipperTripFormProps {
  dayOfWeek: number
  direction: CoastalDirection
  pending: boolean
  previewing: boolean
  repeating: boolean
  weekLabel: string
  error: string | null
  onDay: (day: number) => void
  onDirection: (direction: CoastalDirection) => void
  onSave: (stops: ShipperTripCityPayload[]) => void
}

export function ShipperTripForm({
  dayOfWeek,
  direction,
  pending,
  previewing,
  repeating,
  weekLabel,
  error,
  onDay,
  onDirection,
  onSave,
}: ShipperTripFormProps) {
  const nextKey = useRef(1)
  const [from, setFrom] = useState(() => blankCitySlot("from"))
  const [to, setTo] = useState(() => blankCitySlot("to"))
  const [middles, setMiddles] = useState<ShipperCitySlot[]>([])
  const places = orderedShipperPlaces([from, ...middles, to])
  const disabled = pending || previewing

  function addStop() {
    nextKey.current += 1
    setMiddles((current) => appendShipperSlot(current, blankCitySlot(`stop-${nextKey.current}`)))
  }

  function save() {
    if (!places || disabled) return
    onSave(places.map(({ city, state, latitude, longitude }) => ({ city, state, latitude, longitude })))
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Day">
          <select className={fieldClass} value={dayOfWeek} onChange={(event) => onDay(Number(event.target.value))}>
            {COASTAL_WEEKDAY_LABELS.map((label, day) => (
              <option key={label} value={day}>
                {label}
              </option>
            ))}
          </select>
        </Field>
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
      </div>
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
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" disabled={disabled || !places} onClick={save}>
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

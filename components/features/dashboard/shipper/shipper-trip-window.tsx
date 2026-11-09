"use client"

import type { ReactNode } from "react"

import { COASTAL_WEEKDAY_LABELS } from "@/lib/types/coastal-delivery"
import type { ShipperTripWindow } from "@/lib/utils/shipperTripWindow"

const fieldClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function ShipperTripWindowFields({
  tripWindow,
  pickupDescription,
  deliveryDescription,
  disabled,
  onWindow,
  onPickupDescription,
  onDeliveryDescription,
}: {
  tripWindow: ShipperTripWindow
  pickupDescription: string
  deliveryDescription: string
  disabled: boolean
  onWindow: (next: ShipperTripWindow) => void
  onPickupDescription: (value: string) => void
  onDeliveryDescription: (value: string) => void
}) {
  return (
    <div className="space-y-3">
      <DayRange
        label="Pickup window"
        start={tripWindow.pickupStart}
        end={tripWindow.pickupEnd}
        minStart={0}
        disabled={disabled}
        onStart={(pickupStart) => onWindow({ ...tripWindow, pickupStart })}
        onEnd={(pickupEnd) => onWindow({ ...tripWindow, pickupEnd })}
      />
      <DayRange
        label="Delivery window"
        start={tripWindow.deliveryStart}
        end={tripWindow.deliveryEnd}
        minStart={tripWindow.pickupStart}
        disabled={disabled}
        onStart={(deliveryStart) => onWindow({ ...tripWindow, deliveryStart })}
        onEnd={(deliveryEnd) => onWindow({ ...tripWindow, deliveryEnd })}
      />
      <Field label="Pickup description">
        <input
          className={fieldClass}
          value={pickupDescription}
          maxLength={160}
          disabled={disabled}
          placeholder="What the seller sees"
          aria-label="Pickup description"
          onChange={(event) => onPickupDescription(event.target.value)}
        />
      </Field>
      <Field label="Delivery description">
        <input
          className={fieldClass}
          value={deliveryDescription}
          maxLength={160}
          disabled={disabled}
          placeholder="What the buyer sees for drop-off"
          aria-label="Delivery description"
          onChange={(event) => onDeliveryDescription(event.target.value)}
        />
      </Field>
    </div>
  )
}

function DayRange({
  label,
  start,
  end,
  minStart,
  disabled,
  onStart,
  onEnd,
}: {
  label: string
  start: number
  end: number
  minStart: number
  disabled: boolean
  onStart: (day: number) => void
  onEnd: (day: number) => void
}) {
  const startDays = COASTAL_WEEKDAY_LABELS.map((name, day) => ({ name, day })).filter((item) => item.day >= minStart)
  const endDays = COASTAL_WEEKDAY_LABELS.map((name, day) => ({ name, day })).filter((item) => item.day >= start)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${label} start`}>
        <select className={fieldClass} value={start} disabled={disabled} onChange={(event) => onStart(Number(event.target.value))}>
          {startDays.map((item) => (
            <option key={item.day} value={item.day}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`${label} end`}>
        <select className={fieldClass} value={end} disabled={disabled} onChange={(event) => onEnd(Number(event.target.value))}>
          {endDays.map((item) => (
            <option key={item.day} value={item.day}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
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

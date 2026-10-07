import { type ReactNode } from "react"

import { coastalDirectionLabel } from "@/lib/services/coastalDeliveryMatch"
import {
  COASTAL_WEEKDAY_LABELS,
  type CoastalDirection,
  type CoastalRunView,
  type CoastalStopView,
} from "@/lib/types/coastal-delivery"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function TripChip({
  trip,
  names,
  pending,
  onToggle,
  onRemove,
}: {
  trip: CoastalRunView
  names: string[]
  pending: boolean
  onToggle: (enabled: boolean) => void
  onRemove: () => void
}) {
  return (
    <li className={cn("rounded-lg border px-2 py-1.5", trip.enabled ? "border-foreground/30" : "border-border opacity-70")}>
      <p className="text-[11px] font-medium text-foreground">
        {coastalDirectionLabel(trip.direction)}
        {trip.serviceDate ? "" : " · Every week"}
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">{names.join(", ") || "No towns"}</p>
      <div className="mt-1 flex gap-2">
        <button type="button" className="text-[11px] underline" disabled={pending} onClick={() => onToggle(!trip.enabled)}>
          {trip.enabled ? "On" : "Off"}
        </button>
        <button type="button" className="text-[11px] underline" disabled={pending} onClick={onRemove}>
          Remove
        </button>
      </div>
    </li>
  )
}

export function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm",
        active ? "bg-foreground text-background" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function formatWeek(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day) return iso
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}

interface ShipperTripFormProps {
  ordered: CoastalStopView[]
  dayOfWeek: number
  direction: CoastalDirection
  fromId: string
  toId: string
  rangeNames: string[]
  canSave: boolean
  pending: boolean
  previewing: boolean
  repeating: boolean
  weekLabel: string
  error: string | null
  onDay: (day: number) => void
  onDirection: (direction: CoastalDirection) => void
  onFrom: (id: string) => void
  onTo: (id: string) => void
  onAdd: () => void
}

export function ShipperTripForm({
  ordered,
  dayOfWeek,
  direction,
  fromId,
  toId,
  rangeNames,
  canSave,
  pending,
  previewing,
  repeating,
  weekLabel,
  error,
  onDay,
  onDirection,
  onFrom,
  onTo,
  onAdd,
}: ShipperTripFormProps) {
  return (
    <>
      <div className="grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <select className={fieldClass} value={direction} onChange={(event) => onDirection(event.target.value as CoastalDirection)}>
            <option value="northbound">Northbound</option>
            <option value="southbound">Southbound</option>
          </select>
        </Field>
        <Field label="From">
          <select className={fieldClass} value={fromId} onChange={(event) => onFrom(event.target.value)}>
            {ordered.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="To">
          <select className={fieldClass} value={toId} onChange={(event) => onTo(event.target.value)}>
            {ordered.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">
        {rangeNames.length >= 2 ? rangeNames.join(" · ") : "Pick two different towns. The trip covers every town between them."}
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" disabled={pending || previewing || !canSave} onClick={onAdd}>
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

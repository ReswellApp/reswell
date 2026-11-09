"use client"

import { coastalDirectionLabel, formatCoastalRunWhen } from "@/lib/services/coastalDeliveryMatch"
import type { CoastalMatchReason, CoastalMatchResult, CoastalStopView } from "@/lib/types/coastal-delivery"
import { Label } from "@/components/ui/label"

const fieldClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function CoastalStopSelect({
  id,
  label,
  value,
  stops,
  onChange,
}: {
  id: string
  label: string
  value: string
  stops: CoastalStopView[]
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a stop</option>
        {stops.map((stop) => (
          <option key={stop.id} value={stop.id}>
            {stop.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export function CoastalMatchPanel({
  match,
  shipperId,
  onShipper,
}: {
  match: CoastalMatchResult | null
  shipperId: string
  onShipper: (shipperId: string) => void
}) {
  if (!match) {
    return <p className="text-sm text-muted-foreground">Pick both stops, then check who can cover the route.</p>
  }
  if (match.reason !== "ok") {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{reasonCopy(match.reason)}</p>
    )
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Matching shippers</legend>
      <label className="flex items-start gap-2 text-sm">
        <input type="radio" name="shipper" checked={shipperId === ""} onChange={() => onShipper("")} />
        <span>Wait without choosing a driver</span>
      </label>
      {match.matches.map((item) => (
        <label key={item.shipperId} className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="shipper"
            checked={shipperId === item.shipperId}
            onChange={() => onShipper(item.shipperId)}
          />
          <span>
            {item.displayName} · {coastalDirectionLabel(item.direction)} ·{" "}
            {formatCoastalRunWhen(item.dayOfWeek, item.nextRunOn)}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function reasonCopy(reason: Exclude<CoastalMatchReason, "ok">): string {
  switch (reason) {
    case "same_stop":
      return "Pickup and drop-off are the same stop. Choose two different towns."
    case "no_shippers":
      return "No shippers have joined yet."
    case "schedules_off":
      return "A shipper covers this route, but their weekly schedule or that run is turned off."
    case "no_route_match":
      return "No active run covers both stops in this direction."
  }
}

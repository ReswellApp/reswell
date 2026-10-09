"use client"

import { coastalDirectionLabel } from "@/lib/services/coastalDeliveryMatch"
import type { CoastalRunView } from "@/lib/types/coastal-delivery"
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
      <p className="text-[11px] leading-snug text-muted-foreground">{names.join(" · ") || "No towns"}</p>
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

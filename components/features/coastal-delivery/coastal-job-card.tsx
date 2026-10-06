"use client"

import type { CoastalDashboardJob, CoastalDeliveryStatus } from "@/lib/types/coastal-delivery"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CoastalJobCardProps {
  job: CoastalDashboardJob
  selected: boolean
  pending: boolean
  onSelect: () => void
  onStatus: (status: CoastalDeliveryStatus) => void
}

export function CoastalJobCard({ job, selected, pending, onSelect, onStatus }: CoastalJobCardProps) {
  const next = nextStatus(job.status)
  const undo = undoStatus(job.status)
  return (
    <article
      className={cn(
        "space-y-3 rounded-2xl border border-border/70 bg-card p-4",
        selected && "border-primary ring-2 ring-primary/30",
      )}
    >
      <button type="button" onClick={onSelect} className="min-h-12 w-full text-left">
        <p className="text-base font-medium text-foreground">{job.listingTitle}</p>
        <p className="text-sm text-muted-foreground">{job.saleLabel}</p>
        <p className="mt-2 text-sm text-foreground">Seller · {job.sellerName}</p>
        {job.buyerName ? <p className="text-sm text-foreground">Buyer · {job.buyerName}</p> : null}
        <PlaceLine label="Pickup" place={job.pickupLabel} kind={job.pickupKind} stopName={job.pickupStopName} />
        <PlaceLine label="Drop-off" place={job.dropoffLabel} kind={job.dropoffKind} stopName={job.dropoffStopName} />
        {job.sellerOriginLabel ? <p className="text-sm text-muted-foreground">Note · {job.sellerOriginLabel}</p> : null}
        <p className="mt-2 text-sm font-medium text-foreground">{job.nextHandoff}</p>
      </button>
      {job.statusActionsEnabled && next ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="h-12 flex-1 text-base" disabled={pending} onClick={() => onStatus(next.status)}>
            {next.label}
          </Button>
          {undo ? (
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 text-base"
              disabled={pending}
              onClick={() => onStatus(undo.status)}
            >
              {undo.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function PlaceLine({
  label,
  place,
  kind,
  stopName,
}: {
  label: string
  place: string
  kind: "house" | "stop"
  stopName: string
}) {
  return (
    <p className="text-sm text-foreground">
      {label} · {place}
      <span className="text-muted-foreground"> · {kind === "house" ? "House" : "Stop"}</span>
      {kind === "stop" && place !== stopName ? <span className="text-muted-foreground"> · Map pin {stopName}</span> : null}
    </p>
  )
}

function nextStatus(status: CoastalDeliveryStatus): { status: CoastalDeliveryStatus; label: string } | null {
  if (status === "waiting_for_run") return { status: "picked_up", label: "Picked up" }
  if (status === "picked_up") return { status: "dropped_off", label: "Dropped off" }
  return null
}

function undoStatus(status: CoastalDeliveryStatus): { status: CoastalDeliveryStatus; label: string } | null {
  if (status === "picked_up") return { status: "waiting_for_run", label: "Not picked up yet" }
  if (status === "dropped_off") return { status: "picked_up", label: "Still in the car" }
  return null
}

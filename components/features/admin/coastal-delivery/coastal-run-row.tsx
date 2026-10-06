"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { deleteCoastalRunAction, saveCoastalRunAction } from "@/lib/actions/coastalDeliveryActions"
import { coastalDirectionLabel } from "@/lib/services/coastalDeliveryMatch"
import { COASTAL_WEEKDAY_LABELS, type CoastalRunView, type CoastalStopView } from "@/lib/types/coastal-delivery"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

interface CoastalRunRowProps {
  run: CoastalRunView
  stops: CoastalStopView[]
  shipperId: string
}

export function CoastalRunRow({ run, stops, shipperId }: CoastalRunRowProps) {
  const router = useRouter()
  const [stopIds, setStopIds] = useState(run.stopIds)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const covered = stops.filter((stop) => run.stopIds.includes(stop.id)).map((stop) => stop.name)

  function persist(next: { enabled: boolean; stopIds: string[] }) {
    startTransition(async () => {
      const result = await saveCoastalRunAction({
        shipperId,
        runId: run.id,
        dayOfWeek: run.dayOfWeek,
        direction: run.direction,
        enabled: next.enabled,
        stopIds: next.stopIds,
      })
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }
      setError(null)
      router.refresh()
    })
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteCoastalRunAction({ shipperId, runId: run.id })
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <article className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">
            {COASTAL_WEEKDAY_LABELS[run.dayOfWeek] ?? "Run"} · {coastalDirectionLabel(run.direction)}
          </h3>
          <p className="text-sm text-muted-foreground">
            {run.enabled ? "Run is on" : "Run is off"}
            {covered.length > 0 ? ` · ${covered.join(", ")}` : " · No stops saved"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={run.enabled}
              disabled={pending}
              onCheckedChange={(enabled) => persist({ enabled, stopIds })}
              aria-label="Turn this run on or off"
            />
            {run.enabled ? "On" : "Off"}
          </label>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onDelete}>
            Remove
          </Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {stops.map((stop) => (
          <label key={stop.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={stopIds.includes(stop.id)}
              onChange={(event) => {
                setStopIds((current) =>
                  event.target.checked ? [...current, stop.id] : current.filter((id) => id !== stop.id),
                )
              }}
            />
            {stop.name}
          </label>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => persist({ enabled: run.enabled, stopIds })}
      >
        Save stops
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </article>
  )
}

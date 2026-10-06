"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { deleteCoastalRunAction, saveCoastalRunAction } from "@/lib/actions/coastalDeliveryActions"
import { coastalDirectionLabel } from "@/lib/services/coastalDeliveryMatch"
import { COASTAL_WEEKDAY_LABELS, type CoastalRunView, type CoastalStopView } from "@/lib/types/coastal-delivery"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface ShipperWeekGridProps {
  runs: CoastalRunView[]
  stops: CoastalStopView[]
  shipperId: string
  selectedRunId: string | null
  onSelectRun: (runId: string) => void
}

export function ShipperWeekGrid({ runs, stops, shipperId, selectedRunId, onSelectRun }: ShipperWeekGridProps) {
  const ordered = [...stops].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="admin-surface overflow-x-auto">
      <div className="grid min-w-[56rem] grid-cols-7">
        {COASTAL_WEEKDAY_LABELS.map((label, day) => (
          <section key={label} className="min-w-0 border-r border-border/70 last:border-r-0">
            <h3 className="border-b border-border/70 px-2 py-2 text-xs font-medium">{label}</h3>
            {(["northbound", "southbound"] as const).map((direction) => (
              <div key={direction} className="space-y-2 border-b border-border/40 p-2 last:border-b-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {coastalDirectionLabel(direction)}
                </p>
                {runs
                  .filter((run) => run.dayOfWeek === day && run.direction === direction)
                  .map((run) => (
                    <RunCell
                      key={run.id}
                      run={run}
                      names={ordered.filter((stop) => run.stopIds.includes(stop.id)).map((stop) => stop.name)}
                      shipperId={shipperId}
                      selected={run.id === selectedRunId}
                      onSelect={() => onSelectRun(run.id)}
                    />
                  ))}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

function RunCell({
  run,
  names,
  shipperId,
  selected,
  onSelect,
}: {
  run: CoastalRunView
  names: string[]
  shipperId: string
  selected: boolean
  onSelect: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function persist(enabled: boolean) {
    startTransition(async () => {
      const result = await saveCoastalRunAction({
        shipperId,
        runId: run.id,
        dayOfWeek: run.dayOfWeek,
        direction: run.direction,
        enabled,
        stopIds: run.stopIds,
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
    <div className={cn("rounded-md border p-2", selected ? "border-foreground" : "border-border/70")}>
      <button type="button" onClick={onSelect} className="w-full text-left">
        <ul className="space-y-0.5 text-xs text-foreground">
          {names.length > 0 ? names.map((name) => <li key={name}>{name}</li>) : <li>No stops saved</li>}
        </ul>
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Switch
            checked={run.enabled}
            disabled={pending}
            onCheckedChange={persist}
            aria-label={`Turn this ${run.direction} run on or off`}
          />
          {run.enabled ? "On" : "Off"}
        </label>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={pending} onClick={onDelete}>
          Remove
        </Button>
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

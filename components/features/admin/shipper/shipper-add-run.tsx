"use client"

import { useMemo, useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"

import { saveCoastalRunAction } from "@/lib/actions/coastalDeliveryActions"
import { coastalContinuousStopIds } from "@/lib/services/coastalDeliveryMatch"
import { COASTAL_WEEKDAY_LABELS, type CoastalDirection, type CoastalStopView } from "@/lib/types/coastal-delivery"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const fieldClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

interface ShipperAddRunProps {
  stops: CoastalStopView[]
  shipperId: string
}

export function ShipperAddRun({ stops, shipperId }: ShipperAddRunProps) {
  const router = useRouter()
  const ordered = useMemo(() => [...stops].sort((a, b) => a.sortOrder - b.sortOrder), [stops])
  const [dayOfWeek, setDayOfWeek] = useState(2)
  const [direction, setDirection] = useState<CoastalDirection>("northbound")
  const [fromId, setFromId] = useState(ordered[0]?.id ?? "")
  const [toId, setToId] = useState(ordered[ordered.length - 1]?.id ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const range = coastalContinuousStopIds(ordered, fromId, toId)
  const names = ordered.filter((stop) => range?.includes(stop.id)).map((stop) => stop.name)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!range) return
    startTransition(async () => {
      const result = await saveCoastalRunAction({
        shipperId,
        dayOfWeek,
        direction,
        enabled: true,
        stopIds: range,
      })
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }
      setError(null)
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="admin-surface space-y-4 p-4">
      <h2 className="text-sm font-medium">Add a run</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="shipper-run-day">Day</Label>
          <select
            id="shipper-run-day"
            className={fieldClass}
            value={dayOfWeek}
            onChange={(event) => setDayOfWeek(Number(event.target.value))}
          >
            {COASTAL_WEEKDAY_LABELS.map((label, day) => (
              <option key={label} value={day}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="shipper-run-direction">Direction</Label>
          <select
            id="shipper-run-direction"
            className={fieldClass}
            value={direction}
            onChange={(event) => setDirection(event.target.value as CoastalDirection)}
          >
            <option value="northbound">Northbound</option>
            <option value="southbound">Southbound</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="shipper-run-from">From</Label>
          <select id="shipper-run-from" className={fieldClass} value={fromId} onChange={(event) => setFromId(event.target.value)}>
            {ordered.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="shipper-run-to">To</Label>
          <select id="shipper-run-to" className={fieldClass} value={toId} onChange={(event) => setToId(event.target.value)}>
            {ordered.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {names.length >= 2 ? names.join(", ") : "Pick two different stops. The run covers every stop between them."}
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || !range}>
        {pending ? "Saving…" : "Add run"}
      </Button>
    </form>
  )
}

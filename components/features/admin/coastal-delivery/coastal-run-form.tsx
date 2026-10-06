"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { saveCoastalRunAction } from "@/lib/actions/coastalDeliveryActions"
import { COASTAL_WEEKDAY_LABELS, type CoastalStopView } from "@/lib/types/coastal-delivery"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const fieldClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

interface CoastalRunFormProps {
  stops: CoastalStopView[]
  shipperId: string
}

export function CoastalRunForm({ stops, shipperId }: CoastalRunFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
    const stopIds = formData.getAll("stopIds").map(String)
    startTransition(async () => {
      const result = await saveCoastalRunAction({
        shipperId,
        dayOfWeek: Number(formData.get("dayOfWeek")),
        direction: String(formData.get("direction")),
        enabled: true,
        stopIds,
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
    <form action={onSubmit} className="space-y-4 rounded-lg border p-4">
      <h3 className="text-sm font-medium">Add a weekly run</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dayOfWeek">Day</Label>
          <select id="dayOfWeek" name="dayOfWeek" className={fieldClass} defaultValue="2">
            {COASTAL_WEEKDAY_LABELS.map((label, day) => (
              <option key={label} value={day}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="direction">Direction</Label>
          <select id="direction" name="direction" className={fieldClass} defaultValue="northbound">
            <option value="northbound">Northbound</option>
            <option value="southbound">Southbound</option>
          </select>
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Stops this run covers</legend>
        <p className="text-sm text-muted-foreground">South to north. Pick at least two.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {stops.map((stop) => (
            <label key={stop.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="stopIds" value={stop.id} className="h-4 w-4" />
              {stop.name}
            </label>
          ))}
        </div>
      </fieldset>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || stops.length < 2}>
        {pending ? "Saving…" : "Add run"}
      </Button>
    </form>
  )
}

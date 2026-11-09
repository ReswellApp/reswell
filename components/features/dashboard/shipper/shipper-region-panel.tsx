"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  addCoastalShipperExclusionAction,
  removeCoastalShipperExclusionAction,
  saveCoastalShipperRegionsAction,
} from "@/lib/actions/coastalShipperActions"
import type { CoastalShipperExclusion, CoastalStopView } from "@/lib/types/coastal-delivery"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ShipperRegionPanelProps {
  shipperId: string
  stops: CoastalStopView[]
  regionStopIds: string[]
  regionsExplicit: boolean
  tripsStopIds: string[]
  exclusions: CoastalShipperExclusion[]
  previewing: boolean
}

export function ShipperRegionPanel({
  shipperId,
  stops,
  regionStopIds,
  regionsExplicit,
  tripsStopIds,
  exclusions,
  previewing,
}: ShipperRegionPanelProps) {
  const router = useRouter()
  const ordered = [...stops].sort((a, b) => a.sortOrder - b.sortOrder)
  const initial = new Set(regionsExplicit ? regionStopIds : tripsStopIds)
  const [selected, setSelected] = useState<string[]>(ordered.filter((stop) => initial.has(stop.id)).map((stop) => stop.id))
  const [kind, setKind] = useState<"area" | "address">("area")
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(task: () => Promise<{ error?: string; success?: true }>) {
    startTransition(async () => {
      const result = await task()
      if (result.error) {
        setError(result.error)
        return
      }
      setError(null)
      setLabel("")
      router.refresh()
    })
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="font-headline text-lg font-semibold tracking-tight text-foreground">Regions</h2>
          <p className="text-sm text-muted-foreground">
            Pickup and drop-off stay inside these towns. Anything outside is not yours.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ordered.map((stop) => {
            const on = selected.includes(stop.id)
            return (
              <button
                key={stop.id}
                type="button"
                disabled={previewing}
                onClick={() =>
                  setSelected((current) =>
                    current.includes(stop.id) ? current.filter((id) => id !== stop.id) : [...current, stop.id],
                  )
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
                )}
              >
                {stop.name}
              </button>
            )
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={pending || previewing}
          onClick={() => run(() => saveCoastalShipperRegionsAction({ shipperId, stopIds: selected }))}
        >
          Save regions
        </Button>
      </div>

      <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="font-headline text-lg font-semibold tracking-tight text-foreground">Skip these</h2>
          <p className="text-sm text-muted-foreground">An area or a street you will not pick up or drop off.</p>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            if (label.trim().length < 2 || previewing) return
            run(() => addCoastalShipperExclusionAction({ shipperId, kind, label }))
          }}
        >
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={kind}
            onChange={(event) => setKind(event.target.value as "area" | "address")}
          >
            <option value="area">Area</option>
            <option value="address">Address</option>
          </select>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={kind === "area" ? "Oakland" : "123 State St"}
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button type="submit" variant="outline" disabled={pending || previewing || label.trim().length < 2}>
            Exclude
          </Button>
        </form>
        <ul className="space-y-2">
          {exclusions.length === 0 ? <li className="text-sm text-muted-foreground">Nothing excluded.</li> : null}
          {exclusions.map((exclusion) => (
            <li key={exclusion.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="text-muted-foreground">{exclusion.kind === "area" ? "Area" : "Address"} · </span>
                {exclusion.label}
              </span>
              <button
                type="button"
                className="underline"
                disabled={pending || previewing}
                onClick={() => run(() => removeCoastalShipperExclusionAction({ shipperId, exclusionId: exclusion.id }))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
      {error ? <p className="text-sm text-destructive lg:col-span-2">{error}</p> : null}
    </section>
  )
}

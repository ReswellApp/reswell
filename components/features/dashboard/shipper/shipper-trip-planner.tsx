"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { ShipperTripForm, type ShipperTripCityPayload } from "@/components/features/dashboard/shipper/shipper-trip-form"
import { ModeButton, TripChip, formatWeek } from "@/components/features/dashboard/shipper/shipper-trip-chip"
import {
  removeCoastalShipperTripAction,
  saveCoastalShipperTripAction,
  setCoastalShipperRunAction,
} from "@/lib/actions/coastalShipperActions"
import { addIsoDays, tripDateForWeek, tripsForWeek } from "@/lib/services/coastalShipperWeek"
import { tripStopNames } from "@/lib/utils/shipperTripStops"
import {
  COASTAL_WEEKDAY_LABELS,
  type CoastalDirection,
  type CoastalRunView,
  type CoastalStopView,
} from "@/lib/types/coastal-delivery"
import { Button } from "@/components/ui/button"

interface ShipperTripPlannerProps {
  shipperId: string
  weekStart: string
  stops: CoastalStopView[]
  trips: CoastalRunView[]
  previewing: boolean
}

export function ShipperTripPlanner({ shipperId, weekStart, stops, trips, previewing }: ShipperTripPlannerProps) {
  const router = useRouter()
  const ordered = useMemo(() => [...stops].sort((a, b) => a.sortOrder - b.sortOrder), [stops])
  const [repeating, setRepeating] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [dayOfWeek, setDayOfWeek] = useState(2)
  const [direction, setDirection] = useState<CoastalDirection>("northbound")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const activeStart = addIsoDays(weekStart, weekOffset * 7)
  const visible = repeating ? trips.filter((trip) => !trip.serviceDate) : tripsForWeek(trips, activeStart)

  function run(task: () => Promise<{ error?: string; success?: true }>) {
    startTransition(async () => {
      const result = await task()
      if (result.error) {
        setError(result.error)
        return
      }
      setError(null)
      router.refresh()
    })
  }

  function onSave(cities: ShipperTripCityPayload[]) {
    if (previewing) return
    const dated = tripDateForWeek(activeStart, dayOfWeek, repeating)
    if (!dated) return
    run(() =>
      saveCoastalShipperTripAction({
        shipperId,
        dayOfWeek: dated.dayOfWeek,
        direction,
        enabled: true,
        stops: cities,
        serviceDate: dated.serviceDate,
      }),
    )
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-headline text-lg font-semibold tracking-tight text-foreground">Trips</h2>
          <p className="text-sm text-muted-foreground">
            {repeating
              ? "Same trip every week. Leave it on to be matched."
              : `Only ${formatWeek(activeStart)}. A trip here replaces that weekly run.`}
          </p>
        </div>
        <div className="flex rounded-full border border-border p-1">
          <ModeButton active={repeating} onClick={() => setRepeating(true)}>
            Every week
          </ModeButton>
          <ModeButton active={!repeating} onClick={() => setRepeating(false)}>
            One week
          </ModeButton>
        </div>
      </div>

      {repeating ? null : (
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setWeekOffset((value) => value - 1)}>
            Previous week
          </Button>
          <p className="text-sm font-medium text-foreground">{formatWeek(activeStart)}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setWeekOffset((value) => value + 1)}>
            Next week
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-7">
        {COASTAL_WEEKDAY_LABELS.map((label, day) => {
          const date = addIsoDays(repeating ? weekStart : activeStart, day)
          const dayTrips = visible.filter((trip) => trip.dayOfWeek === day && (repeating ? !trip.serviceDate : true))
          return (
            <div key={label} className="min-h-24 rounded-xl border border-border/70 bg-background p-3 xl:p-2">
              <p className="text-sm font-medium text-foreground xl:text-xs">{label}</p>
              <p className="text-xs text-muted-foreground xl:text-[11px]">{repeating ? "Every week" : formatWeek(date)}</p>
              <ul className="mt-2 space-y-2">
                {dayTrips.map((trip) => (
                  <TripChip
                    key={trip.id}
                    trip={trip}
                    names={tripStopNames(trip.stopIds, ordered, trip.stopsInDriveOrder)}
                    pending={pending || previewing}
                    onToggle={(enabled) => run(() => setCoastalShipperRunAction({ shipperId, runId: trip.id, enabled }))}
                    onRemove={() => run(() => removeCoastalShipperTripAction({ shipperId, runId: trip.id }))}
                  />
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trips yet. Add the first one.</p>
      ) : null}

      <ShipperTripForm
        dayOfWeek={dayOfWeek}
        direction={direction}
        pending={pending}
        previewing={previewing}
        repeating={repeating}
        weekLabel={formatWeek(activeStart)}
        error={error}
        onDay={setDayOfWeek}
        onDirection={setDirection}
        onSave={onSave}
      />
    </section>
  )
}

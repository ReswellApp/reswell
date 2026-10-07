"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { CoastalRunSheet } from "@/components/features/coastal-delivery/coastal-run-sheet"
import { CoastalShipperMap } from "@/components/features/coastal-delivery/coastal-shipper-map"
import { ShipperPricePanel } from "@/components/features/dashboard/shipper/shipper-price-panel"
import { ShipperRegionPanel } from "@/components/features/dashboard/shipper/shipper-region-panel"
import { ShipperTripPlanner } from "@/components/features/dashboard/shipper/shipper-trip-planner"
import { setCoastalShipperScheduleAction } from "@/lib/actions/coastalShipperActions"
import type { CoastalShipperDashboardData } from "@/lib/types/coastal-delivery"
import { Switch } from "@/components/ui/switch"

interface DashboardShipperHomeProps {
  data: CoastalShipperDashboardData
}

export function DashboardShipperHome({ data }: DashboardShipperHomeProps) {
  const router = useRouter()
  const jobs = useMemo(() => data.sections.flatMap((section) => section.jobs), [data.sections])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(jobs[0]?.id ?? null)
  const selected = jobs.some((job) => job.id === selectedJobId) ? selectedJobId : (jobs[0]?.id ?? null)
  const enabledRuns = data.sections.filter((section) => section.runId && section.enabled).length
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onService(enabled: boolean) {
    startTransition(async () => {
      const result = await setCoastalShipperScheduleAction({ shipperId: data.shipperId, enabled })
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }
      setError(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="sticky top-20 z-20 flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm backdrop-blur sm:top-24 lg:static">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{data.weekLabel}</p>
          <h2 className="truncate font-headline text-xl font-semibold tracking-tight text-foreground">{data.displayName}</h2>
          <p className="text-sm text-muted-foreground">
            {data.scheduleEnabled ? "On. You can be matched." : "Off. Turn Shipper on when you are driving."}
          </p>
        </div>
        <label className="flex min-h-12 shrink-0 flex-col items-center justify-center gap-1">
          <Switch
            checked={data.scheduleEnabled}
            disabled={pending}
            onCheckedChange={onService}
            aria-label="Turn Shipper on or off"
          />
          <span className="text-xs font-medium text-foreground">{data.scheduleEnabled ? "On" : "Off"}</span>
        </label>
      </section>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <ShipperPricePanel shipperId={data.shipperId} priceCents={data.priceCents} previewing={data.previewing} />
      <ShipperTripPlanner
        shipperId={data.shipperId}
        weekStart={data.weekStart}
        stops={data.stops}
        trips={data.trips}
        previewing={data.previewing}
      />
      <ShipperRegionPanel
        shipperId={data.shipperId}
        stops={data.stops}
        regionStopIds={data.regionStopIds}
        regionsExplicit={data.regionsExplicit}
        tripsStopIds={[...new Set(data.trips.filter((trip) => trip.enabled).flatMap((trip) => trip.stopIds))]}
        exclusions={data.exclusions}
        previewing={data.previewing}
      />

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Boards" value={String(data.jobCount)} />
        <Stat label="Runs on" value={data.hasRuns ? String(enabledRuns) : "0"} />
        <Stat label="Shipper" value={data.scheduleEnabled ? "On" : "Off"} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="h-64 sm:h-80 lg:h-[420px]">
          <CoastalShipperMap
            coverage={data.coverage}
            jobs={jobs}
            selectedJobId={selected}
            onSelectJob={setSelectedJobId}
            emptyMessage={
              data.coverage.length === 0 && jobs.length === 0
                ? data.hasRuns
                  ? "Turn a run on to see the stops you cover."
                  : "No pickups yet. Add a trip and your coast shows up here."
                : null
            }
          />
        </div>
        <p className="border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
          P is a pickup. D is a drop-off. A filled pin is a house.
        </p>
      </section>

      <CoastalRunSheet
        shipperId={data.shipperId}
        scheduleEnabled={data.scheduleEnabled}
        weekLabel={data.weekLabel}
        sections={data.sections}
        selectedJobId={selected}
        hasRuns={data.hasRuns}
        jobCount={data.jobCount}
        onSelectJob={setSelectedJobId}
        hideServiceToggle
      />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-3 py-3 sm:px-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">{value}</p>
    </div>
  )
}

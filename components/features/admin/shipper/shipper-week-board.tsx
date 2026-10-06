"use client"

import { useMemo, useState } from "react"

import { ShipperAddRun } from "@/components/features/admin/shipper/shipper-add-run"
import { ShipperCoverageMap } from "@/components/features/admin/shipper/shipper-coverage-map"
import { ShipperWeekGrid } from "@/components/features/admin/shipper/shipper-week-grid"
import type { CoastalCoverageStop, CoastalShipperProfileView, CoastalStopView } from "@/lib/types/coastal-delivery"

interface ShipperWeekBoardProps {
  profile: CoastalShipperProfileView
  stops: CoastalStopView[]
  shipperId: string
}

export function ShipperWeekBoard({ profile, stops, shipperId }: ShipperWeekBoardProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(profile.runs[0]?.id ?? null)
  const selected = profile.runs.find((run) => run.id === selectedRunId) ?? null
  const coverage = useMemo(() => coveredStops(stops, profile.runs), [stops, profile.runs])
  const highlightedIds = selected?.stopIds ?? []

  if (profile.runs.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">No runs this week.</p>
        <ShipperAddRun stops={stops} shipperId={shipperId} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ShipperWeekGrid
        runs={profile.runs}
        stops={stops}
        shipperId={shipperId}
        selectedRunId={selected?.id ?? null}
        onSelectRun={setSelectedRunId}
      />
      <div className="admin-surface overflow-hidden">
        <ShipperCoverageMap coverage={coverage} highlightedIds={highlightedIds} />
      </div>
      <ShipperAddRun stops={stops} shipperId={shipperId} />
    </div>
  )
}

function coveredStops(
  stops: CoastalStopView[],
  runs: CoastalShipperProfileView["runs"],
): CoastalCoverageStop[] {
  const ids = new Set(runs.flatMap((run) => run.stopIds))
  return stops
    .filter(
      (stop): stop is CoastalStopView & { latitude: number; longitude: number } =>
        ids.has(stop.id) && typeof stop.latitude === "number" && typeof stop.longitude === "number",
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((stop) => ({
      id: stop.id,
      name: stop.name,
      sortOrder: stop.sortOrder,
      latitude: stop.latitude,
      longitude: stop.longitude,
    }))
}

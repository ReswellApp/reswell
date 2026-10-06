"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { CoastalRunSheet } from "@/components/features/coastal-delivery/coastal-run-sheet"
import { CoastalShipperMap } from "@/components/features/coastal-delivery/coastal-shipper-map"
import type { CoastalShipperDashboardData } from "@/lib/types/coastal-delivery"

interface CoastalShipperDashboardProps {
  data: CoastalShipperDashboardData
}

export function CoastalShipperDashboard({ data }: CoastalShipperDashboardProps) {
  const jobs = useMemo(() => data.sections.flatMap((section) => section.jobs), [data.sections])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(jobs[0]?.id ?? null)
  const selected = jobs.some((job) => job.id === selectedJobId) ? selectedJobId : (jobs[0]?.id ?? null)

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh lg:flex-row">
      <div className="relative sticky top-0 z-10 h-[48dvh] min-h-[280px] shrink-0 lg:static lg:h-dvh lg:min-h-0 lg:w-0 lg:flex-1">
        <CoastalShipperMap
          coverage={data.coverage}
          jobs={jobs}
          selectedJobId={selected}
          onSelectJob={setSelectedJobId}
          emptyMessage={
            data.coverage.length === 0 && jobs.length === 0
              ? data.hasRuns
                ? "Turn a run on to draw the stops you cover."
                : "No stops on your runs yet. The coast shows up here once a weekly run is saved."
              : null
          }
        />
        <p className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md bg-background/95 px-2 py-1 text-xs text-muted-foreground shadow">
          P pickup · D drop-off · filled pin is a house
        </p>
      </div>
      <aside className="flex min-h-0 flex-1 flex-col border-t border-border lg:h-dvh lg:w-[28rem] lg:flex-none lg:overflow-y-auto lg:border-l lg:border-t-0">
        <header className="space-y-1 border-b border-border px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{data.weekLabel}</p>
          <h1 className="font-headline text-2xl font-semibold tracking-tight text-foreground">{data.displayName}</h1>
          <p className="text-sm text-muted-foreground">
            {data.scheduleEnabled ? "Schedule on" : "Schedule off"}
            {data.coverage.length > 0 ? ` · ${data.coverage.map((stop) => stop.name).join(" → ")}` : ""}
          </p>
          {data.previewing ? (
            <p className="text-sm text-muted-foreground">
              Admin preview.{" "}
              <Link href="/admin/shipper" className="underline">
                Back to Shipper
              </Link>
            </p>
          ) : null}
        </header>
        <CoastalRunSheet
          shipperId={data.shipperId}
          scheduleEnabled={data.scheduleEnabled}
          weekLabel={data.weekLabel}
          sections={data.sections}
          selectedJobId={selected}
          hasRuns={data.hasRuns}
          jobCount={data.jobCount}
          onSelectJob={setSelectedJobId}
        />
      </aside>
    </div>
  )
}

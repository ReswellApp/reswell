"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { CoastalRunSheet } from "@/components/features/coastal-delivery/coastal-run-sheet"
import { CoastalShipperMap } from "@/components/features/coastal-delivery/coastal-shipper-map"
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header"
import type { CoastalShipperDashboardData } from "@/lib/types/coastal-delivery"

interface DashboardShipperHomeProps {
  data: CoastalShipperDashboardData
}

export function DashboardShipperHome({ data }: DashboardShipperHomeProps) {
  const jobs = useMemo(() => data.sections.flatMap((section) => section.jobs), [data.sections])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(jobs[0]?.id ?? null)
  const selected = jobs.some((job) => job.id === selectedJobId) ? selectedJobId : (jobs[0]?.id ?? null)
  const enabledRuns = data.sections.filter((section) => section.runId && section.enabled).length
  const coverage = data.coverage.map((stop) => stop.name).join(" → ")

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={data.displayName}
        description={
          data.scheduleEnabled
            ? `${data.weekLabel}. Schedule is on${coverage ? `, covering ${coverage}` : ""}.`
            : `${data.weekLabel}. Schedule is off, so matching treats you as unavailable.`
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Boards this week" value={String(data.jobCount)} hint={data.weekLabel} />
        <Stat
          label="Runs on"
          value={data.hasRuns ? String(enabledRuns) : "0"}
          hint={data.hasRuns ? "Enabled weekly runs" : "No weekly runs saved yet"}
        />
        <Stat
          label="Schedule"
          value={data.scheduleEnabled ? "On" : "Off"}
          hint={data.scheduleEnabled ? "Buyers can match you" : "Turn it on when you are driving"}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="h-[420px]">
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
        </div>
        <p className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-2 text-xs text-muted-foreground">
          <span>P pickup · D drop-off · filled pin is a house</span>
          <Link href="/coastal-delivery" className="underline">
            Full-screen run
          </Link>
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
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
      </section>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}

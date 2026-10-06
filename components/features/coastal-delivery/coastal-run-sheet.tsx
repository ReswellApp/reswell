"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { CoastalJobCard } from "@/components/features/coastal-delivery/coastal-job-card"
import {
  setCoastalShipperJobStatusAction,
  setCoastalShipperRunAction,
  setCoastalShipperScheduleAction,
} from "@/lib/actions/coastalShipperActions"
import type { CoastalRunSheetSection } from "@/lib/types/coastal-delivery"
import { Switch } from "@/components/ui/switch"

interface CoastalRunSheetProps {
  shipperId: string
  scheduleEnabled: boolean
  weekLabel: string
  sections: CoastalRunSheetSection[]
  selectedJobId: string | null
  hasRuns: boolean
  jobCount: number
  onSelectJob: (jobId: string) => void
  /** The shipper home draws its own service switch above the map. */
  hideServiceToggle?: boolean
}

export function CoastalRunSheet({
  shipperId,
  scheduleEnabled,
  weekLabel,
  sections,
  selectedJobId,
  hasRuns,
  jobCount,
  onSelectJob,
  hideServiceToggle = false,
}: CoastalRunSheetProps) {
  const router = useRouter()
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
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {hideServiceToggle ? null : (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Shipper</p>
            <p className="text-sm text-muted-foreground">
              {scheduleEnabled ? "On. You can be matched." : "Off. Turn Shipper on when you are driving."}
            </p>
          </div>
          <div className="flex min-h-12 items-center">
            <Switch
              checked={scheduleEnabled}
              disabled={pending}
              onCheckedChange={(enabled) => run(() => setCoastalShipperScheduleAction({ shipperId, enabled }))}
              aria-label="Turn Shipper on or off"
            />
          </div>
        </div>
      )}
      {!scheduleEnabled ? (
        <p className="rounded-2xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
          Shipper is off. Your runs stay saved. Turn it on when you are driving.
        </p>
      ) : null}
      {!hasRuns ? (
        <p className="rounded-2xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
          No runs yet. They show on the map once an admin saves them.
        </p>
      ) : null}
      {hasRuns && jobCount === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
          No boards this week. {weekLabel}.
        </p>
      ) : null}
      {sections.map((section) => (
        <section key={section.key} className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-foreground">{section.title}</h2>
              <p className="text-sm text-muted-foreground">{section.subtitle}</p>
            </div>
            {section.runId ? (
              <div className="flex min-h-12 items-center">
                <Switch
                  checked={section.enabled}
                  disabled={pending}
                  onCheckedChange={(enabled) => {
                    const runId = section.runId
                    if (!runId) return
                    run(() => setCoastalShipperRunAction({ shipperId, runId, enabled }))
                  }}
                  aria-label={`Turn ${section.title} on or off`}
                />
              </div>
            ) : null}
          </div>
          {section.jobs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/80 px-3 py-3 text-sm text-muted-foreground">
              No boards on this run.
            </p>
          ) : (
            section.jobs.map((job) => (
              <CoastalJobCard
                key={job.id}
                job={job}
                selected={job.id === selectedJobId}
                pending={pending}
                onSelect={() => onSelectJob(job.id)}
                onStatus={(status) => run(() => setCoastalShipperJobStatusAction({ shipperId, requestId: job.id, status }))}
              />
            ))
          )}
        </section>
      ))}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

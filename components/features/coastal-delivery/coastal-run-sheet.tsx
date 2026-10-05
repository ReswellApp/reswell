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
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium text-foreground">Whole schedule</p>
          <p className="text-sm text-muted-foreground">{scheduleEnabled ? "On for matching" : "Off. Buyers will not match you."}</p>
        </div>
        <div className="flex min-h-12 items-center">
          <Switch
            checked={scheduleEnabled}
            disabled={pending}
            onCheckedChange={(enabled) => run(() => setCoastalShipperScheduleAction({ shipperId, enabled }))}
            aria-label="Turn the whole weekly schedule on or off"
          />
        </div>
      </div>
      {!scheduleEnabled ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Schedule is off. Runs stay saved, and new boards will not match you until this is on.
        </p>
      ) : null}
      {!hasRuns ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No weekly runs yet. Stops you cover will show on the map once a run is saved.
        </p>
      ) : null}
      {hasRuns && jobCount === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No boards on your runs this week. {weekLabel}.
        </p>
      ) : null}
      {sections.map((section) => (
        <section key={section.key} className="space-y-3">
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
            <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">No boards on this run.</p>
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

"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { CoastalRunForm } from "@/components/features/admin/coastal-delivery/coastal-run-form"
import { CoastalRunRow } from "@/components/features/admin/coastal-delivery/coastal-run-row"
import { setCoastalScheduleEnabledAction } from "@/lib/actions/coastalDeliveryActions"
import type { CoastalShipperProfileView, CoastalStopView } from "@/lib/types/coastal-delivery"
import { Switch } from "@/components/ui/switch"

interface CoastalScheduleEditorProps {
  profile: CoastalShipperProfileView
  stops: CoastalStopView[]
}

export function CoastalScheduleEditor({ profile, stops }: CoastalScheduleEditorProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSchedule(enabled: boolean) {
    startTransition(async () => {
      const result = await setCoastalScheduleEnabledAction({ enabled })
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }
      setError(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <div>
          <h2 className="text-sm font-medium">Whole schedule</h2>
          <p className="text-sm text-muted-foreground">
            {profile.scheduleEnabled
              ? "On. Enabled runs can match buyers."
              : "Off. Buyers will not match you until this is on."}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={profile.scheduleEnabled}
            disabled={pending}
            onCheckedChange={onSchedule}
            aria-label="Turn the whole weekly schedule on or off"
          />
          {profile.scheduleEnabled ? "On" : "Off"}
        </label>
      </div>
      {!profile.scheduleEnabled ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Schedule is off. Runs stay saved, and matching treats you as unavailable.
        </p>
      ) : null}
      {profile.runs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No weekly runs yet. Add one to cover stops along the corridor.
        </p>
      ) : (
        <div className="space-y-3">
          {profile.runs.map((run) => (
            <CoastalRunRow key={run.id} run={run} stops={stops} />
          ))}
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <CoastalRunForm key={profile.runs.length} stops={stops} />
    </div>
  )
}

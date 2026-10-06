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
  shipperId: string
}

export function CoastalScheduleEditor({ profile, stops, shipperId }: CoastalScheduleEditorProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSchedule(enabled: boolean) {
    startTransition(async () => {
      const result = await setCoastalScheduleEnabledAction({ shipperId, enabled })
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
          <h2 className="text-sm font-medium">Shipper</h2>
          <p className="text-sm text-muted-foreground">
            {profile.scheduleEnabled
              ? "On. Enabled runs can be matched."
              : "Off. This account will not be matched until Shipper is on."}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={profile.scheduleEnabled}
            disabled={pending}
            onCheckedChange={onSchedule}
            aria-label="Turn Shipper on or off"
          />
          {profile.scheduleEnabled ? "On" : "Off"}
        </label>
      </div>
      {!profile.scheduleEnabled ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Shipper is off. Runs stay saved, and this account will not be matched.
        </p>
      ) : null}
      {profile.runs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No runs yet. Add one so this account can take boards.
        </p>
      ) : (
        <div className="space-y-3">
          {profile.runs.map((run) => (
            <CoastalRunRow key={run.id} run={run} stops={stops} shipperId={shipperId} />
          ))}
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <CoastalRunForm key={profile.runs.length} stops={stops} shipperId={shipperId} />
    </div>
  )
}

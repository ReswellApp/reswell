"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { setCoastalScheduleEnabledAction } from "@/lib/actions/coastalDeliveryActions"
import { Switch } from "@/components/ui/switch"

interface ShipperServiceSwitchProps {
  shipperId: string
  scheduleEnabled: boolean
}

export function ShipperServiceSwitch({ shipperId, scheduleEnabled }: ShipperServiceSwitchProps) {
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
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 text-sm">
        <span>{scheduleEnabled ? "On" : "Off"}</span>
        <Switch
          checked={scheduleEnabled}
          disabled={pending}
          onCheckedChange={onSchedule}
          aria-label="Turn Shipper on or off"
        />
      </label>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

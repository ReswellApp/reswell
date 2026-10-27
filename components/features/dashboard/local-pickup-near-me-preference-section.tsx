"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import {
  BrowseLocationRadiusFields,
  type BrowseLocationRadiusValue,
} from "@/components/features/browse/browse-location-radius-fields"
import { saveLocalPickupNearMePreferenceAction } from "@/app/actions/localPickupNearMePreference"
import type { LocalPickupNearMePreference } from "@/lib/db/localPickupNearMePreference"
import { cn } from "@/lib/utils"

export type LocalPickupNearMePreferenceCopy = {
  title: string
  description: string
  toggleLabel: string
  toggleHint: string
  locationHint: string
  saving: string
}

type Props = {
  initialPreference: LocalPickupNearMePreference
  copy: LocalPickupNearMePreferenceCopy
  className?: string
}

function preferenceToFields(pref: LocalPickupNearMePreference): BrowseLocationRadiusValue {
  return {
    location: pref.location,
    lat: pref.lat,
    lng: pref.lng,
    radiusMi: pref.radiusMi ?? "50",
  }
}

export function LocalPickupNearMePreferenceSection({
  initialPreference,
  copy,
  className,
}: Props) {
  const [enabled, setEnabled] = useState(initialPreference.enabled)
  const [fields, setFields] = useState<BrowseLocationRadiusValue>(() =>
    preferenceToFields(initialPreference),
  )
  const [saving, setSaving] = useState(false)

  async function persist(nextEnabled: boolean, nextFields: BrowseLocationRadiusValue) {
    setSaving(true)
    const result = await saveLocalPickupNearMePreferenceAction({
      enabled: nextEnabled,
      location: nextFields.location,
      lat: nextFields.lat,
      lng: nextFields.lng,
      radiusMi:
        nextFields.radiusMi === "any" ? null : (nextFields.radiusMi as "25" | "50" | "100" | "200"),
    })
    setSaving(false)

    if (!result.ok) {
      toast.error(result.error)
      return false
    }

    setEnabled(result.preference.enabled)
    setFields(preferenceToFields(result.preference))
    toast.success(
      result.preference.enabled
        ? "Local pickup near you is on for surfboard browse."
        : "Local pickup filter turned off.",
    )
    return true
  }

  async function handleToggle(checked: boolean) {
    if (checked) {
      setEnabled(true)
      if (fields.lat != null && fields.lng != null) {
        const ok = await persist(true, fields)
        if (!ok) setEnabled(false)
      } else {
        toast.message("Choose a location", {
          description: "Pick a city or ZIP (or use your current location) to turn this on.",
        })
      }
      return
    }
    const ok = await persist(false, fields)
    if (ok) setEnabled(false)
  }

  async function handleFieldsChange(next: BrowseLocationRadiusValue) {
    setFields(next)
    if (!enabled) return
    if (next.lat == null || next.lng == null) return
    await persist(true, next)
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <h2 className="text-base font-semibold text-foreground">{copy.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <div className="rounded-lg border border-border bg-card px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="local-pickup-near-me" className="text-[14px] font-medium text-foreground">
              {copy.toggleLabel}
            </Label>
            <p className="text-[12px] leading-snug text-muted-foreground">{copy.toggleHint}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            <Switch
              id="local-pickup-near-me"
              checked={enabled}
              disabled={saving}
              onCheckedChange={(checked) => void handleToggle(checked)}
            />
          </div>
        </div>

        {enabled ? (
          <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
            <p className="text-[12px] text-muted-foreground">{copy.locationHint}</p>
            <BrowseLocationRadiusFields
              value={fields}
              onChange={(next) => void handleFieldsChange(next)}
              disabled={saving}
              locationInputName="profile-local-pickup-location"
            />
            <p className="text-[11px] leading-snug text-muted-foreground">{copy.saving}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

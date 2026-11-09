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
import { saveProfileBrowseHomeAction } from "@/app/actions/profileBrowseHome"
import type { ProfileBrowseHome } from "@/lib/db/profileBrowseHome"
import {
  profileSectionHintClass,
  profileSectionTitleClass,
} from "@/components/features/dashboard/profile-settings/profile-settings-styles"
import { cn } from "@/lib/utils"

export type ProfileBrowseHomeSectionCopy = {
  title: string
  description: string
  applyLabel: string
  applyHint: string
  pickupOnlyLabel: string
  pickupOnlyHint: string
  locationHint: string
  saving: string
}

type Props = {
  initialHome: ProfileBrowseHome
  copy: ProfileBrowseHomeSectionCopy
  className?: string
}

function homeToFields(home: ProfileBrowseHome): BrowseLocationRadiusValue {
  return {
    location: home.location,
    lat: home.lat,
    lng: home.lng,
    radiusMi: home.radiusMi ?? "50",
  }
}

export function ProfileBrowseHomeSection({ initialHome, copy, className }: Props) {
  const [applyOnBoards, setApplyOnBoards] = useState(initialHome.applyOnBoards)
  const [localPickupOnly, setLocalPickupOnly] = useState(initialHome.localPickupOnly)
  const [fields, setFields] = useState<BrowseLocationRadiusValue>(() => homeToFields(initialHome))
  const [saving, setSaving] = useState(false)

  async function persist(next: {
    applyOnBoards: boolean
    localPickupOnly: boolean
    fields: BrowseLocationRadiusValue
  }) {
    setSaving(true)
    const result = await saveProfileBrowseHomeAction({
      applyOnBoards: next.applyOnBoards,
      localPickupOnly: next.localPickupOnly,
      location: next.fields.location,
      lat: next.fields.lat,
      lng: next.fields.lng,
      radiusMi:
        next.fields.radiusMi === "any"
          ? null
          : (next.fields.radiusMi as "25" | "50" | "100" | "200"),
    })
    setSaving(false)

    if (!result.ok) {
      toast.error(result.error)
      return false
    }

    setApplyOnBoards(result.home.applyOnBoards)
    setLocalPickupOnly(result.home.localPickupOnly)
    setFields(homeToFields(result.home))
    toast.success("Home area saved.")
    return true
  }

  async function handleApplyToggle(checked: boolean) {
    if (checked) {
      setApplyOnBoards(true)
      if (fields.lat != null && fields.lng != null) {
        const ok = await persist({ applyOnBoards: true, localPickupOnly, fields })
        if (!ok) setApplyOnBoards(false)
      } else {
        toast.message("Choose a home area", {
          description: "Pick a city or ZIP (or use your current location) before turning this on.",
        })
      }
      return
    }
    const ok = await persist({ applyOnBoards: false, localPickupOnly, fields })
    if (ok) setApplyOnBoards(false)
  }

  async function handlePickupOnlyToggle(checked: boolean) {
    setLocalPickupOnly(checked)
    await persist({ applyOnBoards, localPickupOnly: checked, fields })
  }

  async function handleFieldsChange(next: BrowseLocationRadiusValue) {
    setFields(next)
    if (next.lat == null || next.lng == null) return
    await persist({ applyOnBoards, localPickupOnly, fields: next })
  }

  return (
    <div className={cn("space-y-3 border-t border-neutral-200/80 pt-6", className)}>
      <div>
        <p className={profileSectionTitleClass}>{copy.title}</p>
        <p className={cn(profileSectionHintClass, "mt-1")}>{copy.description}</p>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card px-4 py-4 sm:px-5">
        <div className="space-y-2">
          <p className="text-[12px] text-muted-foreground">{copy.locationHint}</p>
          <BrowseLocationRadiusFields
            value={fields}
            onChange={(next) => void handleFieldsChange(next)}
            disabled={saving}
            locationInputName="profile-browse-home-location"
          />
        </div>

        <div className="flex items-start justify-between gap-3 border-t border-border/60 pt-4">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="browse-home-apply" className="text-[14px] font-medium text-foreground">
              {copy.applyLabel}
            </Label>
            <p className="text-[12px] leading-snug text-muted-foreground">{copy.applyHint}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            <Switch
              id="browse-home-apply"
              checked={applyOnBoards}
              disabled={saving}
              onCheckedChange={(checked) => void handleApplyToggle(checked)}
            />
          </div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="browse-home-pickup" className="text-[14px] font-medium text-foreground">
              {copy.pickupOnlyLabel}
            </Label>
            <p className="text-[12px] leading-snug text-muted-foreground">{copy.pickupOnlyHint}</p>
          </div>
          <Switch
            id="browse-home-pickup"
            checked={localPickupOnly}
            disabled={saving || !applyOnBoards}
            onCheckedChange={(checked) => void handlePickupOnlyToggle(checked)}
          />
        </div>

        <p className="text-[11px] leading-snug text-muted-foreground">{copy.saving}</p>
      </div>
    </div>
  )
}

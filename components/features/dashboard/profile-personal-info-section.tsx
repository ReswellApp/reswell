"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"
import { updateProfilePersonalInfoAction } from "@/app/actions/profilePersonalInfo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  profileCardClass,
  profileInputClass,
  profileLabelClass,
  profilePillButtonClass,
  profileSectionHintClass,
  profileSectionTitleClass,
} from "@/components/features/dashboard/profile-settings/profile-settings-styles"

export type ProfilePersonalInfoCopy = {
  title: string
  description: string
  privateBadge: string
  firstName: string
  lastName: string
  phone: string
  phoneDisclosure: string
  save: string
  update: string
  saving: string
  saved: string
}

function hasAnyStoredPersonalInfo(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  phone: string | null | undefined,
): boolean {
  return Boolean(firstName?.trim() || lastName?.trim() || phone?.trim())
}

interface ProfilePersonalInfoSectionProps {
  copy: ProfilePersonalInfoCopy
  initialFirstName: string | null
  initialLastName: string | null
  initialPhone: string | null
}

export function ProfilePersonalInfoSection({
  copy,
  initialFirstName,
  initialLastName,
  initialPhone,
}: ProfilePersonalInfoSectionProps) {
  const [firstName, setFirstName] = useState(initialFirstName ?? "")
  const [lastName, setLastName] = useState(initialLastName ?? "")
  const [phone, setPhone] = useState(initialPhone ?? "")
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [hasStoredOnce, setHasStoredOnce] = useState(() =>
    hasAnyStoredPersonalInfo(initialFirstName, initialLastName, initialPhone),
  )

  useEffect(() => {
    setFirstName(initialFirstName ?? "")
    setLastName(initialLastName ?? "")
    setPhone(initialPhone ?? "")
    setHasStoredOnce(hasAnyStoredPersonalInfo(initialFirstName, initialLastName, initialPhone))
  }, [initialFirstName, initialLastName, initialPhone])

  const showPhoneDisclosure = phone.trim().length > 0

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateProfilePersonalInfoAction({
        first_name: firstName,
        last_name: lastName,
        phone,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setHasStoredOnce(true)
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 2000)
    } catch {
      toast.error("Could not save personal information.")
    } finally {
      setSaving(false)
    }
  }

  const buttonLabel = hasStoredOnce ? copy.update : copy.save

  return (
    <section className={`${profileCardClass} space-y-5 p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className={cn(profileSectionTitleClass, "flex items-center gap-2")}>
            <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
            {copy.title}
          </h2>
          <p className={profileSectionHintClass}>{copy.description}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-xs font-medium">
          {copy.privateBadge}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="personal-first-name" className={profileLabelClass}>
            {copy.firstName}
          </Label>
          <Input
            id="personal-first-name"
            autoComplete="given-name"
            className={profileInputClass}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="chicken"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="personal-last-name" className={profileLabelClass}>
            {copy.lastName}
          </Label>
          <Input
            id="personal-last-name"
            autoComplete="family-name"
            className={profileInputClass}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="joe"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="personal-phone" className={profileLabelClass}>
          {copy.phone}
        </Label>
        <Input
          id="personal-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className={profileInputClass}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 555-5555"
        />
        {showPhoneDisclosure ? (
          <p className="rounded-lg bg-neutral-100 px-3 py-2.5 text-xs italic leading-relaxed text-muted-foreground">
            {copy.phoneDisclosure}
          </p>
        ) : null}
      </div>

      <Button
        className={profilePillButtonClass(saving || savedFlash)}
        onClick={() => void handleSave()}
        disabled={saving || savedFlash}
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            {copy.saving}
          </>
        ) : savedFlash ? (
          <>
            <Check className="mr-2 h-4 w-4" aria-hidden />
            {copy.saved}
          </>
        ) : (
          buttonLabel
        )}
      </Button>
    </section>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"
import { updateProfilePersonalInfoAction } from "@/app/actions/profilePersonalInfo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

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
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
              {copy.title}
            </CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs font-medium">
            {copy.privateBadge}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="personal-first-name">{copy.firstName}</Label>
            <Input
              id="personal-first-name"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="chicken"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="personal-last-name">{copy.lastName}</Label>
            <Input
              id="personal-last-name"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="joe"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="personal-phone">{copy.phone}</Label>
          <Input
            id="personal-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
          />
          {showPhoneDisclosure ? (
            <p
              className={cn(
                "rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground",
              )}
            >
              {copy.phoneDisclosure}
            </p>
          ) : null}
        </div>

        <Button onClick={() => void handleSave()} disabled={saving || savedFlash}>
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
      </CardContent>
    </Card>
  )
}

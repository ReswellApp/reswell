"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { joinCoastalShipperAction } from "@/lib/actions/coastalDeliveryActions"
import type { CoastalShipperProfileView } from "@/lib/types/coastal-delivery"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CoastalJoinFormProps {
  profile: CoastalShipperProfileView | null
}

export function CoastalJoinForm({ profile }: CoastalJoinFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
    setSaved(false)
    startTransition(async () => {
      const result = await joinCoastalShipperAction({
        displayName: String(formData.get("displayName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      })
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }
      setError(null)
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <form action={onSubmit} className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">Name</Label>
        <Input id="displayName" name="displayName" defaultValue={profile?.displayName ?? ""} required minLength={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={profile?.phone ?? ""} autoComplete="tel" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={profile?.notes ?? ""}
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {profile ? (
        <p className="text-sm text-muted-foreground">
          You already joined. Saving updates this profile. The weekly schedule stays as you left it.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Joining is instant in this draft. The weekly schedule starts off until you turn it on.
        </p>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-foreground">Profile saved.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : profile ? "Update profile" : "Join as shipper"}
      </Button>
    </form>
  )
}

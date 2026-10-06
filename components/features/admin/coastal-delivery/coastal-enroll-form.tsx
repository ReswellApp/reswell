"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { enrollCoastalShipperAccountAction } from "@/lib/actions/coastalDeliveryActions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function CoastalEnrollForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
    setSaved(false)
    startTransition(async () => {
      const result = await enrollCoastalShipperAccountAction({
        email: String(formData.get("email") ?? ""),
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
      formRef.current?.reset()
      router.refresh()
    })
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="enroll-email">Account email</Label>
        <Input id="enroll-email" name="email" type="email" autoComplete="off" required placeholder="shop@example.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="enroll-name">Name on the run</Label>
        <Input id="enroll-name" name="displayName" required minLength={2} placeholder="North Coast Boards" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="enroll-phone">Phone</Label>
        <Input id="enroll-phone" name="phone" autoComplete="tel" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="enroll-notes">Notes</Label>
        <textarea
          id="enroll-notes"
          name="notes"
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        The account must already exist on Reswell. Their schedule starts off. After this, Shipper shows on their dashboard.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-foreground">Account signed up. They can open Shipper from their dashboard.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Signing up…" : "Sign up account"}
      </Button>
    </form>
  )
}

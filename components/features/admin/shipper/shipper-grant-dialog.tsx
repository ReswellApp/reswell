"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { enrollCoastalShipperAccountAction } from "@/lib/actions/coastalDeliveryActions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ShipperGrantDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
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
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">Grant Shipper</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant Shipper</DialogTitle>
          <DialogDescription>
            Use an existing Reswell account email. Their service starts off, and Shipper appears on their dashboard.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="grant-email">Account email</Label>
            <Input id="grant-email" name="email" type="email" autoComplete="off" required placeholder="shop@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grant-name">Name on the run</Label>
            <Input id="grant-name" name="displayName" required minLength={2} placeholder="North Coast Boards" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grant-phone">Phone</Label>
            <Input id="grant-phone" name="phone" autoComplete="tel" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grant-notes">Notes</Label>
            <textarea
              id="grant-notes"
              name="notes"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Granting…" : "Grant Shipper"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

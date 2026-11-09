"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  grantDropoffLocationAccountAction,
  revokeDropoffLocationGrantAction,
} from "@/lib/actions/dropoffLocationActions"
import type { DropoffLocationGrantView } from "@/lib/services/dropoffLocationGrants"
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

interface DropoffLocationGrantPanelProps {
  locations: Array<{ id: string; name: string }>
  grants: DropoffLocationGrantView[]
}

export function DropoffLocationGrantPanel({ locations, grants }: DropoffLocationGrantPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [removingId, setRemovingId] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await grantDropoffLocationAccountAction({
        email: String(formData.get("email") ?? ""),
        dropoffLocationId: String(formData.get("dropoffLocationId") ?? ""),
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

  function onRemove(grantId: string) {
    if (!window.confirm("Remove this dropoff location from that account?")) return
    setRemovingId(grantId)
    startTransition(async () => {
      const result = await revokeDropoffLocationGrantAction({ grantId })
      setRemovingId(null)
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }
      setError(null)
      router.refresh()
    })
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Dropoff accounts</h2>
          <p className="text-sm text-muted-foreground">
            Grant an existing Reswell account. Drop-off then appears on their dashboard.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) setError(null)
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" disabled={locations.length === 0}>
              Grant dropoff location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grant dropoff location</DialogTitle>
              <DialogDescription>
                Use an existing account email. They can open Drop-off on their dashboard for this location.
              </DialogDescription>
            </DialogHeader>
            <form action={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dropoff-grant-email">Account email</Label>
                <Input
                  id="dropoff-grant-email"
                  name="email"
                  type="email"
                  autoComplete="off"
                  required
                  placeholder="shop@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dropoff-grant-location">Location</Label>
                <select
                  id="dropoff-grant-location"
                  name="dropoffLocationId"
                  required
                  defaultValue={locations[0]?.id ?? ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Granting…" : "Grant dropoff location"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && !open ? <p className="text-sm text-destructive">{error}</p> : null}

      {grants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts have a dropoff location yet.</p>
      ) : (
        <ul className="divide-y divide-border/70">
          {grants.map((grant) => (
            <li key={grant.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {grant.displayName?.trim() || grant.email || "Account"}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {grant.email ? `${grant.email} · ` : ""}
                  {grant.locationName}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={pending && removingId === grant.id}
                onClick={() => onRemove(grant.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

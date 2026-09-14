"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { saveSellerShipFromAddress } from "@/lib/actions/sellerShipFromActions"
import type { ListingLocalityFromAddress } from "@/lib/sell-flow/listing-locality-from-address"
import { CheckoutAddressLine1Field } from "@/components/features/checkout/checkout-address-line1-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ShipFromForm = {
  full_name: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
}

const emptyForm: ShipFromForm = {
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",
}

export function SellShipFromAddressDialog({
  open,
  needsFullName,
  needsPhone,
  allowDismissToPickup,
  title = "Where will this ship from?",
  description = "One-time setup. We save this to your addresses and use it only to print a shipping label after a sale. Buyers see your city — never your street address.",
  onSaved,
  onDismissToPickup,
}: {
  open: boolean
  needsFullName: boolean
  needsPhone: boolean
  allowDismissToPickup: boolean
  title?: string
  description?: string
  onSaved: (locality: ListingLocalityFromAddress) => void
  onDismissToPickup?: () => void
}) {
  const [form, setForm] = useState<ShipFromForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  function handleOpenChange(next: boolean) {
    if (next) return
    if (allowDismissToPickup) {
      onDismissToPickup?.()
    }
  }

  async function handleSave() {
    if (!form.line1.trim() || !form.city.trim() || !form.postal_code.trim()) {
      toast.error("Street, city, and ZIP code are required.")
      return
    }
    if (needsFullName && !form.full_name.trim()) {
      toast.error("Enter the name to print on shipping labels.")
      return
    }
    if (needsPhone && !form.phone.trim()) {
      toast.error("Enter a phone number for the carrier.")
      return
    }

    setSaving(true)
    try {
      const { locality, error } = await saveSellerShipFromAddress({
        line1: form.line1.trim(),
        line2: form.line2.trim() || null,
        city: form.city.trim(),
        state: form.state.trim() || null,
        postal_code: form.postal_code.trim(),
        country: form.country.trim() || "US",
        label: "Ship from",
        is_default: true,
        ...(needsFullName ? { full_name: form.full_name.trim() } : {}),
        ...(needsPhone ? { phone: form.phone.trim() } : {}),
      })
      if (error || !locality) {
        toast.error(error ?? "Could not save address")
        return
      }
      setForm(emptyForm)
      onSaved(locality)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={allowDismissToPickup}
        className="max-h-[90vh] max-w-lg overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          if (!allowDismissToPickup) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2 sm:grid-cols-2">
          {needsFullName ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sell-ship-from-name">Name on the label</Label>
              <Input
                id="sell-ship-from-name"
                autoComplete="name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="First and last name"
              />
            </div>
          ) : null}
          {needsPhone ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sell-ship-from-phone">Phone</Label>
              <Input
                id="sell-ship-from-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(555) 555-5555"
              />
            </div>
          ) : null}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sell-ship-from-line1">Street address</Label>
            <CheckoutAddressLine1Field
              id="sell-ship-from-line1"
              listboxId="sell-ship-from-line1-suggest"
              value={form.line1}
              onChange={(line1) => setForm((f) => ({ ...f, line1 }))}
              onAddressResolved={(addr) => {
                setForm((f) => ({
                  ...f,
                  line1: addr.line1,
                  line2: addr.line2 || f.line2,
                  city: addr.city,
                  state: addr.state,
                  postal_code: addr.postal_code,
                  country: addr.country || "US",
                }))
              }}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sell-ship-from-line2">Apt, suite (optional)</Label>
            <Input
              id="sell-ship-from-line2"
              autoComplete="address-line2"
              value={form.line2}
              onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sell-ship-from-city">City</Label>
            <Input
              id="sell-ship-from-city"
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sell-ship-from-state">State</Label>
            <Input
              id="sell-ship-from-state"
              autoComplete="address-level1"
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sell-ship-from-zip">ZIP</Label>
            <Input
              id="sell-ship-from-zip"
              autoComplete="postal-code"
              inputMode="numeric"
              value={form.postal_code}
              onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sell-ship-from-country">Country</Label>
            <Input
              id="sell-ship-from-country"
              autoComplete="country-name"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {allowDismissToPickup ? (
            <Button type="button" variant="outline" onClick={() => onDismissToPickup?.()}>
              Local pickup only
            </Button>
          ) : null}
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save ship-from address"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

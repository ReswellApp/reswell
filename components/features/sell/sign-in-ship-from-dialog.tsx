"use client"

import { useEffect, useState } from "react"
import { Loader2, MapPin } from "lucide-react"
import { toast } from "sonner"

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
import { saveSellerShipFromAddress } from "@/lib/actions/sellerShipFromActions"
import type { SignInShipFromPrefill } from "@/lib/services/signInShipFromPrompt"

export type SignInShipFromDialogPrompt = {
  needsFullName: boolean
  needsPhone: boolean
  addressId: string | null
  title: string
  description: string
  detail: string | null
  prefill: SignInShipFromPrefill
}

export function SignInShipFromDialog({
  open,
  prompt,
  onSaved,
  onDismiss,
}: {
  open: boolean
  prompt: SignInShipFromDialogPrompt
  onSaved: () => void
  onDismiss: () => void
}) {
  const [form, setForm] = useState<SignInShipFromPrefill>(prompt.prefill)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(prompt.prefill)
  }, [open, prompt])

  async function handleSave() {
    if (!form.line1.trim() || !form.city.trim() || !form.postal_code.trim()) {
      toast.error("Street, city, and ZIP code are required.")
      return
    }
    if (prompt.needsFullName && !form.full_name.trim()) {
      toast.error("Enter the name to print on shipping labels.")
      return
    }
    if (prompt.needsPhone && !form.phone.trim()) {
      toast.error("Enter a phone number for the carrier.")
      return
    }

    setSaving(true)
    try {
      const { error } = await saveSellerShipFromAddress({
        line1: form.line1.trim(),
        line2: form.line2.trim() || null,
        city: form.city.trim(),
        state: form.state.trim() || null,
        postal_code: form.postal_code.trim(),
        country: form.country.trim() || "US",
        label: "Ship from",
        is_default: true,
        ...(prompt.addressId ? { address_id: prompt.addressId } : {}),
        ...(prompt.needsFullName ? { full_name: form.full_name.trim() } : {}),
        ...(prompt.needsPhone ? { phone: form.phone.trim() } : {}),
      })
      if (error) {
        toast.error(error)
        return
      }
      toast.success("Ship-from address saved. Shipping can be priced from here.")
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onDismiss() }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:rounded-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F9F9F2] text-[#5574AD]">
              <MapPin className="h-5 w-5" aria-hidden />
            </span>
            <div className="space-y-1 text-left">
              <DialogTitle>{prompt.title}</DialogTitle>
              <DialogDescription>{prompt.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {prompt.detail ? (
          <p className="rounded-xl bg-[#F9F9F2] px-3 py-2.5 text-sm text-[#163060]">
            {prompt.detail}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {prompt.needsFullName ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="signin-ship-from-name">Name on the label</Label>
              <Input
                id="signin-ship-from-name"
                autoComplete="name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="First and last name"
              />
            </div>
          ) : null}
          {prompt.needsPhone ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="signin-ship-from-phone">Phone</Label>
              <Input
                id="signin-ship-from-phone"
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
            <Label htmlFor="signin-ship-from-line1">Street address</Label>
            <CheckoutAddressLine1Field
              id="signin-ship-from-line1"
              listboxId="signin-ship-from-line1-suggest"
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
            <Label htmlFor="signin-ship-from-line2">Apt, suite (optional)</Label>
            <Input
              id="signin-ship-from-line2"
              autoComplete="address-line2"
              value={form.line2}
              onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signin-ship-from-city">City</Label>
            <Input
              id="signin-ship-from-city"
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signin-ship-from-state">State</Label>
            <Input
              id="signin-ship-from-state"
              autoComplete="address-level1"
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signin-ship-from-zip">ZIP</Label>
            <Input
              id="signin-ship-from-zip"
              autoComplete="postal-code"
              inputMode="numeric"
              value={form.postal_code}
              onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signin-ship-from-country">Country</Label>
            <Input
              id="signin-ship-from-country"
              autoComplete="country-name"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onDismiss} disabled={saving}>
            Remind me next sign-in
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save ship-from address"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

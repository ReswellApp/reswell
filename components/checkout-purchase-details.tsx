"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createProfileAddress } from "@/app/actions/addresses"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ProfileAddressRow } from "@/lib/profile-address"

function formatAddressLine(a: ProfileAddressRow) {
  const parts = [a.line1, a.city, a.state, a.postal_code].filter(Boolean)
  return parts.join(", ")
}

export type PurchaseDetailsState = {
  readyToPay: boolean
  /** Required for Stripe when shipping; null for pickup-only checkout. */
  shippingAddressId: string | null
}

export function CheckoutPurchaseDetails({
  buyerEmail,
  initialAddresses,
  needsShipping,
  onStateChange,
}: {
  buyerEmail: string | null
  initialAddresses: ProfileAddressRow[]
  needsShipping: boolean
  onStateChange: (state: PurchaseDetailsState) => void
}) {
  const [addresses, setAddresses] = useState<ProfileAddressRow[]>(initialAddresses)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const d = initialAddresses.find((a) => a.is_default)
    return d?.id ?? initialAddresses[0]?.id ?? null
  })
  const [showNewForm, setShowNewForm] = useState(() => initialAddresses.length === 0 && needsShipping)
  const prevSelectedRef = useRef<string | null>(selectedId)

  const [pickupName, setPickupName] = useState("")
  const [pickupPhone, setPickupPhone] = useState("")

  const [draft, setDraft] = useState({
    full_name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "US",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!needsShipping) return
    if (addresses.length === 0) {
      setShowNewForm(true)
      setSelectedId(null)
    } else {
      setShowNewForm(false)
      const d = addresses.find((a) => a.is_default) ?? addresses[0]
      if (d) {
        setSelectedId(d.id)
        prevSelectedRef.current = d.id
      }
    }
  }, [needsShipping])

  const draftValid = useMemo(() => {
    return (
      draft.full_name.trim().length > 0 &&
      draft.line1.trim().length > 0 &&
      draft.city.trim().length > 0 &&
      draft.postal_code.trim().length > 0 &&
      draft.country.trim().length >= 2
    )
  }, [draft])

  const computeAndNotify = useCallback(() => {
    if (!needsShipping) {
      onStateChange({
        readyToPay: pickupName.trim().length > 0,
        shippingAddressId: null,
      })
      return
    }

    if (showNewForm) {
      onStateChange({ readyToPay: false, shippingAddressId: null })
      return
    }

    if (selectedId) {
      onStateChange({ readyToPay: true, shippingAddressId: selectedId })
      return
    }

    onStateChange({ readyToPay: false, shippingAddressId: null })
  }, [needsShipping, pickupName, showNewForm, selectedId, onStateChange])

  useEffect(() => {
    computeAndNotify()
  }, [computeAndNotify])

  const openNewAddressForm = () => {
    prevSelectedRef.current = selectedId
    setSelectedId(null)
    setShowNewForm(true)
  }

  const cancelNewAddressForm = () => {
    setShowNewForm(false)
    setSelectedId(prevSelectedRef.current)
    setDraft({
      full_name: "",
      phone: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "US",
    })
  }

  const saveNewAddress = async () => {
    if (!draftValid) {
      toast.error("Fill in name, street, city, postal code, and country.")
      return
    }
    setSaving(true)
    try {
      const { address, error } = await createProfileAddress({
        full_name: draft.full_name,
        phone: draft.phone || null,
        line1: draft.line1,
        line2: draft.line2 || null,
        city: draft.city,
        state: draft.state || null,
        postal_code: draft.postal_code,
        country: draft.country,
        label: null,
        is_default: addresses.length === 0,
      })
      if (error || !address) {
        toast.error(error ?? "Could not save address")
        return
      }
      setAddresses((prev) => [address, ...prev.filter((a) => a.id !== address.id)])
      setSelectedId(address.id)
      prevSelectedRef.current = address.id
      setShowNewForm(false)
      setDraft({
        full_name: "",
        phone: "",
        line1: "",
        line2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "US",
      })
      toast.success("Address saved")
    } finally {
      setSaving(false)
    }
  }

  const fieldClass =
    "h-11 rounded-[6px] border-neutral-300 bg-white shadow-none transition-colors focus-visible:border-[#3b63e3] focus-visible:ring-[#3b63e3]/25"

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Contact</h3>
        <div className="space-y-1.5">
          <Label htmlFor="checkout-email" className="text-[13px] font-normal text-neutral-600">
            Email
          </Label>
          <Input
            id="checkout-email"
            type="email"
            autoComplete="email"
            value={buyerEmail ?? ""}
            readOnly
            disabled
            className={`${fieldClass} bg-neutral-50 text-neutral-700`}
          />
          <p className="text-xs text-neutral-500">Receipts and order updates are sent here.</p>
        </div>
      </section>

      {!needsShipping && (
        <section className="space-y-4">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Pickup details</h3>
          <div className="space-y-1.5">
            <Label htmlFor="checkout-pickup-name" className="text-[13px] font-normal text-neutral-600">
              Full name
            </Label>
            <Input
              id="checkout-pickup-name"
              autoComplete="name"
              value={pickupName}
              onChange={(e) => setPickupName(e.target.value)}
              placeholder="Name for your order"
              className={fieldClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="checkout-pickup-phone" className="text-[13px] font-normal text-neutral-600">
              Phone <span className="text-neutral-400">(optional)</span>
            </Label>
            <Input
              id="checkout-pickup-phone"
              type="tel"
              autoComplete="tel"
              value={pickupPhone}
              onChange={(e) => setPickupPhone(e.target.value)}
              placeholder="For pickup coordination"
              className={fieldClass}
            />
          </div>
        </section>
      )}

      {needsShipping && (
        <section className="space-y-4">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Delivery</h3>

          {addresses.length > 0 && !showNewForm && (
            <div className="space-y-2">
              <Label className="text-[13px] font-normal text-neutral-600">Ship to</Label>
              <Select
                value={selectedId ?? undefined}
                onValueChange={(v) => {
                  setSelectedId(v)
                  prevSelectedRef.current = v
                }}
              >
                <SelectTrigger
                  className={`${fieldClass} h-11 !text-left data-[placeholder]:text-neutral-400`}
                >
                  <SelectValue placeholder="Choose a saved address" />
                </SelectTrigger>
                <SelectContent>
                  {addresses.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name} — {formatAddressLine(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full rounded-[6px] border-neutral-300 text-[13px] font-medium text-neutral-700 shadow-none hover:bg-neutral-50"
                onClick={openNewAddressForm}
              >
                Use a different address
              </Button>
            </div>
          )}

          {(addresses.length === 0 || showNewForm) && (
            <div className="space-y-3 rounded-[8px] border border-neutral-200 bg-neutral-50/80 p-4 sm:p-5">
              <p className="text-sm font-medium text-foreground">
                {addresses.length === 0 ? "Add your shipping address" : "New address"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="addr-name" className="text-[13px] font-normal text-neutral-600">
                    Full name
                  </Label>
                  <Input
                    id="addr-name"
                    autoComplete="shipping name"
                    value={draft.full_name}
                    onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="addr-phone" className="text-[13px] font-normal text-neutral-600">
                    Phone <span className="text-neutral-400">(optional)</span>
                  </Label>
                  <Input
                    id="addr-phone"
                    type="tel"
                    autoComplete="tel"
                    value={draft.phone}
                    onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="addr-line1" className="text-[13px] font-normal text-neutral-600">
                    Address line 1
                  </Label>
                  <Input
                    id="addr-line1"
                    autoComplete="address-line1"
                    value={draft.line1}
                    onChange={(e) => setDraft((d) => ({ ...d, line1: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="addr-line2" className="text-[13px] font-normal text-neutral-600">
                    Address line 2 <span className="text-neutral-400">(optional)</span>
                  </Label>
                  <Input
                    id="addr-line2"
                    autoComplete="address-line2"
                    value={draft.line2}
                    onChange={(e) => setDraft((d) => ({ ...d, line2: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="addr-city" className="text-[13px] font-normal text-neutral-600">
                    City
                  </Label>
                  <Input
                    id="addr-city"
                    autoComplete="address-level2"
                    value={draft.city}
                    onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="addr-state" className="text-[13px] font-normal text-neutral-600">
                    State / region
                  </Label>
                  <Input
                    id="addr-state"
                    autoComplete="address-level1"
                    value={draft.state}
                    onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="addr-zip" className="text-[13px] font-normal text-neutral-600">
                    Postal code
                  </Label>
                  <Input
                    id="addr-zip"
                    autoComplete="postal-code"
                    value={draft.postal_code}
                    onChange={(e) => setDraft((d) => ({ ...d, postal_code: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="addr-country" className="text-[13px] font-normal text-neutral-600">
                    Country
                  </Label>
                  <Input
                    id="addr-country"
                    autoComplete="country"
                    value={draft.country}
                    onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
                    placeholder="US"
                    className={fieldClass}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <Button
                  type="button"
                  onClick={saveNewAddress}
                  disabled={saving || !draftValid}
                  className="h-11 rounded-[6px] bg-[#3b63e3] text-[15px] font-semibold text-white shadow-none hover:bg-[#2d54d8]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save address"
                  )}
                </Button>
                {addresses.length > 0 && showNewForm && (
                  <Button type="button" variant="ghost" onClick={cancelNewAddressForm} className="text-neutral-600">
                    Back to saved addresses
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

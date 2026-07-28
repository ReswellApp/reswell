"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createProfileAddress, updateProfileAddress } from "@/app/actions/addresses"
import { updateProfilePersonalInfoAction } from "@/app/actions/profilePersonalInfo"
import {
  CheckoutAddressLine1Field,
  type ResolvedCheckoutAddress,
} from "@/components/features/checkout/checkout-address-line1-field"
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
import type { ShippingAddressFormInput } from "@/lib/address-input"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { toE164UsPhone } from "@/lib/utils/phone-e164-us"

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
  buyerPhone = null,
  initialAddresses,
  needsShipping,
  legalFullName = "",
  onStateChange,
}: {
  buyerEmail: string | null
  buyerPhone?: string | null
  initialAddresses: ProfileAddressRow[]
  needsShipping: boolean
  /** From private profile personal info — used for pickup and shipping identity. */
  legalFullName?: string
  onStateChange: (state: PurchaseDetailsState) => void
}) {
  const [addresses, setAddresses] = useState<ProfileAddressRow[]>(initialAddresses)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const d = initialAddresses.find((a) => a.is_default)
    return d?.id ?? initialAddresses[0]?.id ?? null
  })
  const [showNewForm, setShowNewForm] = useState(() => initialAddresses.length === 0 && needsShipping)
  const prevSelectedRef = useRef<string | null>(selectedId)

  const [pickupName, setPickupName] = useState(legalFullName)
  const [phone, setPhone] = useState(() => buyerPhone?.trim() ?? "")
  const [persistedPhone, setPersistedPhone] = useState(() => buyerPhone?.trim() ?? "")
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const [draft, setDraft] = useState<ShippingAddressFormInput>({
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "US",
  })
  const [saving, setSaving] = useState(false)

  const phoneValid = useMemo(() => toE164UsPhone(phone) != null, [phone])

  const applyResolvedAddress = useCallback((addr: ResolvedCheckoutAddress) => {
    setDraft((d) => ({
      ...d,
      line1: addr.line1.trim() || d.line1,
      line2: addr.line2.trim(),
      city: addr.city.trim() || d.city,
      state: addr.state.trim() || d.state,
      postal_code: addr.postal_code.trim() || d.postal_code,
      country: (addr.country.trim() || d.country).slice(0, 2).toUpperCase() || d.country,
    }))
  }, [])

  useEffect(() => {
    if (legalFullName.trim() && !pickupName.trim()) {
      setPickupName(legalFullName.trim())
    }
  }, [legalFullName, pickupName])

  useEffect(() => {
    const next = buyerPhone?.trim() ?? ""
    if (!next) return
    setPhone((prev) => (prev.trim() ? prev : next))
    setPersistedPhone((prev) => (prev.trim() ? prev : next))
  }, [buyerPhone])

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
      draft.line1.trim().length > 0 &&
      draft.city.trim().length > 0 &&
      draft.postal_code.trim().length > 0 &&
      draft.country.trim().length >= 2
    )
  }, [draft])

  const persistPhone = useCallback(async (): Promise<boolean> => {
    const trimmed = phone.trim()
    if (!toE164UsPhone(trimmed)) {
      setPhoneError("Enter a valid US phone number.")
      return false
    }
    if (trimmed === persistedPhone.trim()) {
      setPhoneError(null)
      return true
    }

    setPhoneSaving(true)
    try {
      const result = await updateProfilePersonalInfoAction({ phone: trimmed })
      if (!result.ok) {
        setPhoneError(result.error)
        toast.error(result.error)
        return false
      }
      const saved = result.personal.phone?.trim() || trimmed
      setPersistedPhone(saved)
      setPhone(saved)
      setPhoneError(null)

      if (selectedId) {
        const { address, error } = await updateProfileAddress(selectedId, { phone: saved })
        if (!error && address) {
          setAddresses((prev) => prev.map((a) => (a.id === address.id ? address : a)))
        }
      }
      return true
    } finally {
      setPhoneSaving(false)
    }
  }, [phone, persistedPhone, selectedId])

  const phoneReady =
    phoneValid && toE164UsPhone(phone) === toE164UsPhone(persistedPhone)

  useEffect(() => {
    if (!phoneValid) return
    if (toE164UsPhone(phone) === toE164UsPhone(persistedPhone)) return
    const timer = window.setTimeout(() => {
      void persistPhone()
    }, 450)
    return () => window.clearTimeout(timer)
  }, [phone, phoneValid, persistedPhone, persistPhone])

  const computeAndNotify = useCallback(() => {
    const pickupNameOk = pickupName.trim().length > 0

    if (!needsShipping) {
      onStateChange({
        readyToPay: pickupNameOk && phoneReady,
        shippingAddressId: null,
      })
      return
    }

    if (showNewForm) {
      onStateChange({
        readyToPay: false,
        shippingAddressId: null,
      })
      return
    }

    if (selectedId) {
      const selected = addresses.find((a) => a.id === selectedId)
      onStateChange({
        readyToPay: !!selected && phoneReady,
        shippingAddressId: selectedId,
      })
      return
    }

    onStateChange({
      readyToPay: false,
      shippingAddressId: null,
    })
  }, [needsShipping, pickupName, phoneReady, showNewForm, selectedId, addresses, onStateChange])

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
      toast.error("Fill in street, city, postal code, and country.")
      return
    }
    if (!phoneValid) {
      setPhoneError("Enter a valid US phone number.")
      toast.error("Phone number is required.")
      return
    }
    setSaving(true)
    try {
      const phoneOk = await persistPhone()
      if (!phoneOk) return

      const { address, error } = await createProfileAddress({
        line1: draft.line1,
        line2: draft.line2 || null,
        city: draft.city,
        state: draft.state || null,
        postal_code: draft.postal_code,
        country: draft.country,
        phone: phone.trim(),
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
        line1: "",
        line2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "US",
      })
    } finally {
      setSaving(false)
    }
  }

  const fieldClass =
    "h-11 rounded-[6px] border-neutral-300 bg-white shadow-none transition-colors focus-visible:border-[#5574AD] focus-visible:ring-[#5574AD]/25"

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
          <p className="text-xs text-neutral-500">Receipts and purchase updates are sent here.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="checkout-phone" className="text-[13px] font-normal text-neutral-600">
            Phone <span className="text-neutral-400">(required)</span>
          </Label>
          <Input
            id="checkout-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            aria-required
            aria-invalid={phoneError ? true : undefined}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              if (phoneError) setPhoneError(null)
            }}
            onBlur={() => {
              void persistPhone()
            }}
            placeholder="(555) 555-5555"
            className={fieldClass}
          />
          {phoneError ? (
            <p className="text-xs text-destructive">{phoneError}</p>
          ) : (
            <p className="text-xs text-neutral-500">
              {phoneSaving
                ? "Saving phone…"
                : "Required for delivery updates and carrier labels."}
            </p>
          )}
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
              required
              aria-required
              onChange={(e) => setPickupName(e.target.value)}
              placeholder="Name for your purchase"
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
                      {a.label?.trim() ? `${a.label} — ` : ""}
                      {formatAddressLine(a)}
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
              {legalFullName.trim() ? (
                <p className="text-xs text-neutral-500">
                  Ships to {legalFullName.trim()} — update your name under Addresses if needed.
                </p>
              ) : (
                <p className="text-xs text-amber-700">
                  Add your first and last name under Addresses → Personal information before checkout.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="addr-line1" className="text-[13px] font-normal text-neutral-600">
                    Address line 1
                  </Label>
                  <p className="text-[12px] leading-relaxed text-neutral-500">
                    {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
                      ? "US addresses (Google). Choose a suggestion to fill city, state, and ZIP — or type manually."
                      : "US addresses only. Suggestions as you type; choosing one fills city, state, and ZIP."}
                  </p>
                  <CheckoutAddressLine1Field
                    id="addr-line1"
                    name="address-line1"
                    listboxId="checkout-address-line1-suggest"
                    placeholder="Street number and name"
                    debounceMs={150}
                    value={draft.line1}
                    onChange={(v) => setDraft((d) => ({ ...d, line1: v }))}
                    onAddressResolved={applyResolvedAddress}
                    inputClassName={fieldClass}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="addr-line2" className="text-[13px] font-normal text-neutral-600">
                    Address line 2 <span className="text-neutral-400">(optional)</span>
                  </Label>
                  <Input
                    id="addr-line2"
                    autoComplete="address-line2"
                    value={draft.line2 ?? ""}
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
                    value={draft.state ?? ""}
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
                  className="h-11 rounded-[6px] bg-[#5574AD] text-[15px] font-semibold text-white shadow-none hover:bg-[#466091]"
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

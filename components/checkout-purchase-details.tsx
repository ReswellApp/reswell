"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createProfileAddress } from "@/app/actions/addresses"
import { saveGuestCheckoutContactEmail } from "@/app/actions/guestCheckoutContact"
import { saveGuestPickupContact } from "@/app/actions/guestCheckoutPickup"
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
import type { ProfileAddressInput } from "@/lib/address-input"
import type { ProfileAddressRow } from "@/lib/profile-address"
import type {
  SessionlessGuestPaymentRequest,
} from "@/lib/checkout/sessionless-guest-stripe-payload"
import { z } from "zod"

type GuestShippingInput = ProfileAddressInput

function profileRowToGuestShipping(a: ProfileAddressRow): GuestShippingInput {
  return {
    full_name: a.full_name,
    phone: a.phone?.trim() ? a.phone.trim() : null,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postal_code: a.postal_code,
    country: a.country,
    label: a.label,
    is_default: a.is_default,
  }
}

function formatAddressLine(a: ProfileAddressRow) {
  const parts = [a.line1, a.city, a.state, a.postal_code].filter(Boolean)
  return parts.join(", ")
}

export type PurchaseDetailsState = {
  readyToPay: boolean
  /** Required for Stripe when shipping; null for pickup-only checkout. */
  shippingAddressId: string | null
  /** Guest checkout: saved contact email on profile before payment. Always true for signed-in buyers. */
  guestContactReady: boolean
  /** True sessionless guest checkout only — full PaymentIntent body when the form is valid. */
  sessionlessGuestPay: SessionlessGuestPaymentRequest | null
  /** Sessionless shipping quote — set when a ship-to address is selected. */
  sessionlessShippingForQuote: GuestShippingInput | null
}

const guestEmailSchema = z.string().trim().email()

function RequiredFieldMark() {
  return (
    <span className="ml-0.5 cursor-help font-semibold text-destructive" title="Required" aria-hidden="true">
      *
    </span>
  )
}

export function CheckoutPurchaseDetails({
  listingId,
  buyerEmail,
  contactEmailMode,
  initialAddresses,
  needsShipping,
  onStateChange,
}: {
  listingId: string
  buyerEmail: string | null
  /** `guest` — Supabase anonymous; `sessionless` — no auth; `account` — signed-in. */
  contactEmailMode: "account" | "guest" | "sessionless"
  initialAddresses: ProfileAddressRow[]
  needsShipping: boolean
  onStateChange: (state: PurchaseDetailsState) => void
}) {
  const guestStyleLabels = contactEmailMode === "guest" || contactEmailMode === "sessionless"
  const isSupabaseGuest = contactEmailMode === "guest"
  const isSessionless = contactEmailMode === "sessionless"
  const [addresses, setAddresses] = useState<ProfileAddressRow[]>(initialAddresses)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const d = initialAddresses.find((a) => a.is_default)
    return d?.id ?? initialAddresses[0]?.id ?? null
  })
  const [showNewForm, setShowNewForm] = useState(() => initialAddresses.length === 0 && needsShipping)
  const prevSelectedRef = useRef<string | null>(selectedId)

  const [pickupName, setPickupName] = useState("")
  const [guestPickupSaveState, setGuestPickupSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [guestPickupNameError, setGuestPickupNameError] = useState<string | null>(null)

  const [guestEmailInput, setGuestEmailInput] = useState(() => buyerEmail?.trim() ?? "")
  const [guestEmailSaveState, setGuestEmailSaveState] = useState<"idle" | "saving" | "saved" | "error">(() => {
    if (contactEmailMode !== "guest" && contactEmailMode !== "sessionless") return "idle"
    const t = buyerEmail?.trim() ?? ""
    return t && guestEmailSchema.safeParse(t).success ? "saved" : "idle"
  })
  const [guestEmailError, setGuestEmailError] = useState<string | null>(null)

  const guestEmailValid = guestEmailSchema.safeParse(guestEmailInput).success
  const guestEmailCommitted =
    contactEmailMode === "guest"
      ? guestEmailSaveState === "saved" && guestEmailValid
      : contactEmailMode === "sessionless"
        ? guestEmailValid
        : true

  const [draft, setDraft] = useState({
    full_name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "US",
  })
  const [saving, setSaving] = useState(false)

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
    const base =
      draft.full_name.trim().length > 0 &&
      draft.line1.trim().length > 0 &&
      draft.city.trim().length > 0 &&
      draft.postal_code.trim().length > 0 &&
      draft.country.trim().length >= 2
    return base
  }, [draft])

  const tryPersistGuestPickup = useCallback(async () => {
    if (needsShipping) return
    if (contactEmailMode === "sessionless") {
      const name = pickupName.trim()
      if (!name) {
        setGuestPickupNameError("Full name is required.")
        return
      }
      setGuestPickupNameError(null)
      setGuestPickupSaveState("saved")
      return
    }
    if (contactEmailMode !== "guest") return
    const name = pickupName.trim()
    if (!name) {
      setGuestPickupNameError("Full name is required.")
      return
    }
    setGuestPickupNameError(null)
    setGuestPickupSaveState("saving")
    const r = await saveGuestPickupContact({ full_name: name })
    if (!r.ok) {
      setGuestPickupSaveState("error")
      toast.error(r.error)
      return
    }
    setGuestPickupSaveState("saved")
  }, [contactEmailMode, needsShipping, pickupName])

  const computeAndNotify = useCallback(() => {
    const guestContactReady =
      contactEmailMode === "guest" || contactEmailMode === "sessionless" ? guestEmailCommitted : true

    const pickupNameOk = pickupName.trim().length > 0

    const guestPickupOk =
      contactEmailMode === "account" ||
      (isSessionless ? pickupNameOk : guestPickupSaveState === "saved" && pickupNameOk)

    const buildSessionlessPay = (): SessionlessGuestPaymentRequest | null => {
      if (!isSessionless || !guestContactReady) return null
      const email = guestEmailInput.trim()
      if (!guestEmailSchema.safeParse(email).success) return null
      if (!needsShipping) {
        if (!pickupNameOk) return null
        return {
          listing_id: listingId,
          guest_checkout: true,
          buyer_email: email,
          fulfillment: "pickup",
          pickup: {
            full_name: pickupName.trim(),
          },
        }
      }
      const selected = addresses.find((a) => a.id === selectedId)
      if (!selected) return null
      return {
        listing_id: listingId,
        guest_checkout: true,
        buyer_email: email,
        fulfillment: "shipping",
        shipping: profileRowToGuestShipping(selected),
      }
    }

    const sessionlessGuestPay = buildSessionlessPay()

    let sessionlessShippingForQuote: GuestShippingInput | null = null
    if (isSessionless && needsShipping && selectedId) {
      const selected = addresses.find((a) => a.id === selectedId)
      if (selected) {
        sessionlessShippingForQuote = profileRowToGuestShipping(selected)
      }
    }

    if (!needsShipping) {
      onStateChange({
        readyToPay: pickupNameOk && guestContactReady && guestPickupOk,
        shippingAddressId: null,
        guestContactReady,
        sessionlessGuestPay,
        sessionlessShippingForQuote: null,
      })
      return
    }

    if (showNewForm) {
      onStateChange({
        readyToPay: false,
        shippingAddressId: null,
        guestContactReady,
        sessionlessGuestPay: null,
        sessionlessShippingForQuote: null,
      })
      return
    }

    if (selectedId) {
      const selected = addresses.find((a) => a.id === selectedId)
      onStateChange({
        readyToPay: guestContactReady && !!selected,
        shippingAddressId: selectedId,
        guestContactReady,
        sessionlessGuestPay,
        sessionlessShippingForQuote,
      })
      return
    }

    onStateChange({
      readyToPay: false,
      shippingAddressId: null,
      guestContactReady,
      sessionlessGuestPay: null,
      sessionlessShippingForQuote: null,
    })
  }, [
    needsShipping,
    pickupName,
    guestPickupSaveState,
    addresses,
    showNewForm,
    selectedId,
    onStateChange,
    contactEmailMode,
    guestEmailCommitted,
    guestEmailInput,
    isSessionless,
    listingId,
  ])

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
      toast.error(
        guestStyleLabels
          ? "Fill in name, street, city, postal code, and country."
          : "Fill in name, street, city, postal code, and country.",
      )
      return
    }
    setSaving(true)
    try {
      if (isSessionless) {
        const now = new Date().toISOString()
        const localAddr: ProfileAddressRow = {
          id: crypto.randomUUID(),
          profile_id: "00000000-0000-0000-0000-000000000000",
          full_name: draft.full_name,
          phone: null,
          line1: draft.line1,
          line2: draft.line2?.trim() || null,
          city: draft.city,
          state: draft.state?.trim() || null,
          postal_code: draft.postal_code,
          country: draft.country,
          label: null,
          is_default: addresses.length === 0,
          created_at: now,
          updated_at: now,
        }
        setAddresses((prev) => [localAddr, ...prev.filter((a) => a.id !== localAddr.id)])
        setSelectedId(localAddr.id)
        prevSelectedRef.current = localAddr.id
        setShowNewForm(false)
        setDraft({
          full_name: "",
          line1: "",
          line2: "",
          city: "",
          state: "",
          postal_code: "",
          country: "US",
        })
        toast.success("Address added")
        return
      }

      const { address, error } = await createProfileAddress({
        full_name: draft.full_name,
        phone: null,
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
            Email{guestStyleLabels ? <RequiredFieldMark /> : null}
          </Label>
          {contactEmailMode === "account" ? (
            <>
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
            </>
          ) : (
            <>
              <Input
                id="checkout-email"
                type="email"
                autoComplete="email"
                value={guestEmailInput}
                onChange={(e) => {
                  setGuestEmailInput(e.target.value)
                  setGuestEmailSaveState("idle")
                  setGuestEmailError(null)
                }}
                onBlur={async () => {
                  const trimmed = guestEmailInput.trim()
                  if (!trimmed) {
                    setGuestEmailError("Email is required.")
                    return
                  }
                  if (!guestEmailSchema.safeParse(trimmed).success) {
                    setGuestEmailError("Enter a valid email address.")
                    return
                  }
                  if (isSessionless) {
                    setGuestEmailError(null)
                    setGuestEmailSaveState("saved")
                    return
                  }
                  setGuestEmailSaveState("saving")
                  setGuestEmailError(null)
                  const r = await saveGuestCheckoutContactEmail({ email: trimmed })
                  if (!r.ok) {
                    setGuestEmailSaveState("error")
                    setGuestEmailError(r.error)
                    return
                  }
                  setGuestEmailSaveState("saved")
                }}
                placeholder="you@example.com"
                className={fieldClass}
                required={guestStyleLabels}
                aria-required={guestStyleLabels}
              />
              {guestEmailError ? <p className="text-xs text-destructive">{guestEmailError}</p> : null}
              {guestEmailSaveState === "saving" ? (
                <p className="text-xs text-neutral-500">Saving…</p>
              ) : guestEmailSaveState === "saved" && guestEmailValid ? (
                <p className="text-xs text-neutral-500">
                  {isSessionless
                    ? "Receipts and order updates go here."
                    : "Saved — receipts and order updates go here."}
                </p>
              ) : (
                <p className="text-xs text-neutral-500">
                  {isSessionless
                    ? "Enter a valid email before payment."
                    : "Tab out of the field to save. Required before payment."}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {!needsShipping && (
        <section className="space-y-4">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Pickup details</h3>
          <div className="space-y-1.5">
            <Label htmlFor="checkout-pickup-name" className="text-[13px] font-normal text-neutral-600">
              Full name{guestStyleLabels ? <RequiredFieldMark /> : null}
            </Label>
            <Input
              id="checkout-pickup-name"
              autoComplete="name"
              value={pickupName}
              required={guestStyleLabels}
              aria-required={guestStyleLabels}
              onChange={(e) => {
                setPickupName(e.target.value)
                setGuestPickupNameError(null)
                if (guestStyleLabels) setGuestPickupSaveState("idle")
              }}
              onBlur={() => void tryPersistGuestPickup()}
              placeholder="Name for your order"
              className={fieldClass}
            />
            {guestStyleLabels && guestPickupNameError ? (
              <p className="text-xs text-destructive">{guestPickupNameError}</p>
            ) : null}
            {guestStyleLabels ? (
              <>
                {guestPickupSaveState === "saving" ? (
                  <p className="text-xs text-neutral-500">Saving…</p>
                ) : guestPickupSaveState === "saved" ? (
                  <p className="text-xs text-neutral-500">Saved.</p>
                ) : null}
              </>
            ) : null}
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
                    Full name{guestStyleLabels ? <RequiredFieldMark /> : null}
                  </Label>
                  <Input
                    id="addr-name"
                    autoComplete="shipping name"
                    value={draft.full_name}
                    onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
                    className={fieldClass}
                    required={guestStyleLabels}
                    aria-required={guestStyleLabels}
                  />
                </div>
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

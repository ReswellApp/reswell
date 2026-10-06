"use client"

import { useEffect, useState } from "react"

import { getProfileAddresses } from "@/app/actions/addresses"
import {
  SurfboardShippedPickupFields,
  type SurfboardShippedPickupForm,
} from "@/components/features/sell/surfboard-shipped-pickup-fields"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  getListingSurfboardShippedChoiceAction,
} from "@/lib/actions/surfboardShippedActions"
import type { ProfileAddressRow } from "@/lib/profile-address"
import {
  SURFBOARD_SHIPPED_FEE_USD,
  SURFBOARD_SHIPPED_NAME,
  SURFBOARD_SHIPPED_WINDOW_LABEL,
  isCaliforniaAddressState,
  type LiveSurfboardShipper,
} from "@/lib/services/surfboardShipped"
import { cn } from "@/lib/utils"

export type SurfboardShippedSellDraft = {
  enabled: boolean
  ready: boolean
  addressId: string | null
  address: {
    full_name: string
    phone: string
    line1: string
    line2: string | null
    city: string
    state: string
    postal_code: string
    country: string
    google_place_id: string | null
    latitude: number | null
    longitude: number | null
    formatted_address: string | null
  } | null
}

const EMPTY_DRAFT: SurfboardShippedSellDraft = {
  enabled: false,
  ready: true,
  addressId: null,
  address: null,
}

export function SurfboardShippedChoice({
  offer,
  locationState,
  editListingId,
  onChange,
}: {
  offer: { liveShippers: LiveSurfboardShipper[] } | null
  locationState: string
  editListingId: string | null
  onChange: (draft: SurfboardShippedSellDraft) => void
}) {
  const visible =
    offer != null &&
    offer.liveShippers.length > 0 &&
    isCaliforniaAddressState(locationState)
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(!editListingId)
  const [addressId, setAddressId] = useState<string | null>(null)
  const [saved, setSaved] = useState<ProfileAddressRow[]>([])
  const [form, setForm] = useState<SurfboardShippedPickupForm>({
    full_name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "CA",
    postal_code: "",
    country: "US",
    google_place_id: "",
    latitude: null,
    longitude: null,
    formatted_address: "",
  })

  useEffect(() => {
    if (!visible) {
      onChange(EMPTY_DRAFT)
      return
    }
    const address =
      form.line1.trim() && form.city.trim() && form.postal_code.trim() && form.full_name.trim()
        ? {
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            line1: form.line1.trim(),
            line2: form.line2.trim() || null,
            city: form.city.trim(),
            state: form.state.trim(),
            postal_code: form.postal_code.trim(),
            country: "US",
            google_place_id: form.google_place_id.trim() || null,
            latitude: form.latitude,
            longitude: form.longitude,
            formatted_address: form.formatted_address.trim() || null,
          }
        : null
    onChange({
      enabled,
      ready,
      addressId,
      address: enabled ? address : null,
    })
  }, [addressId, enabled, form, onChange, ready, visible])

  useEffect(() => {
    if (!visible) return
    void getProfileAddresses().then(({ addresses }) => {
      setSaved(addresses.filter((row) => isCaliforniaAddressState(row.state)))
    })
  }, [visible])

  useEffect(() => {
    if (!editListingId) {
      setReady(true)
      return
    }
    if (!visible) return
    let cancelled = false
    setReady(false)
    void getListingSurfboardShippedChoiceAction(editListingId).then((choice) => {
      if (cancelled) return
      if (choice?.enabled && choice.address) {
        setEnabled(true)
        setAddressId(choice.address.id)
        setForm({
          full_name: choice.address.full_name,
          phone: choice.address.phone ?? "",
          line1: choice.address.line1,
          line2: choice.address.line2 ?? "",
          city: choice.address.city,
          state: choice.address.state ?? "CA",
          postal_code: choice.address.postal_code,
          country: "US",
          google_place_id: choice.address.google_place_id ?? "",
          latitude: choice.address.latitude ?? null,
          longitude: choice.address.longitude ?? null,
          formatted_address: choice.address.formatted_address ?? "",
        })
      }
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [editListingId, visible])

  if (!visible || !offer) return null

  return (
    <div
      className={cn(
        "rounded-lg border p-3 sm:rounded-xl sm:p-5",
        enabled ? "border-foreground bg-background shadow-sm" : "border-border",
      )}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <Checkbox
          id="sell-surfboard-shipped"
          checked={enabled}
          onCheckedChange={(value) => setEnabled(value === true)}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="sell-surfboard-shipped" className="cursor-pointer text-xs font-semibold sm:text-sm">
            {SURFBOARD_SHIPPED_NAME}
          </Label>
          <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
            A shipper picks the board up at a California street and drives it to the
            buyer. Any California city qualifies. Buyers pay ${SURFBOARD_SHIPPED_FEE_USD} at checkout.
            Drop-off is {SURFBOARD_SHIPPED_WINDOW_LABEL}.
          </p>
          <ul className="space-y-1 text-xs text-foreground sm:text-sm">
            {offer.liveShippers.map((shipper) => (
              <li key={shipper.id}>
                {shipper.displayName} · Live
              </li>
            ))}
          </ul>
          {enabled ? (
            <SurfboardShippedPickupFields
              form={form}
              saved={saved}
              onPick={(row) => {
                setAddressId(row.id)
                setForm({
                  full_name: row.full_name,
                  phone: row.phone ?? "",
                  line1: row.line1,
                  line2: row.line2 ?? "",
                  city: row.city,
                  state: row.state ?? "CA",
                  postal_code: row.postal_code,
                  country: "US",
                  google_place_id: row.google_place_id ?? "",
                  latitude: row.latitude ?? null,
                  longitude: row.longitude ?? null,
                  formatted_address: row.formatted_address ?? "",
                })
              }}
              onChange={(next) => {
                setAddressId(null)
                setForm(next)
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

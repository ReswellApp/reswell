"use client"

import { CheckoutAddressLine1Field } from "@/components/features/checkout/checkout-address-line1-field"
import { Input } from "@/components/ui/input"
import type { ProfileAddressRow } from "@/lib/profile-address"

export type SurfboardShippedPickupForm = {
  full_name: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
}

export function SurfboardShippedPickupFields({
  form,
  saved,
  onPick,
  onChange,
}: {
  form: SurfboardShippedPickupForm
  saved: ProfileAddressRow[]
  onPick: (row: ProfileAddressRow) => void
  onChange: (next: SurfboardShippedPickupForm) => void
}) {
  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs font-semibold text-foreground sm:text-sm">Pickup name, phone, and address</p>
      {saved.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {saved.map((row) => (
            <button
              key={row.id}
              type="button"
              className="rounded-md border border-border px-2 py-1 text-left text-xs hover:border-foreground"
              onClick={() => onPick(row)}
            >
              {row.full_name} · {row.city}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          aria-label="Pickup name"
          placeholder="Name"
          value={form.full_name}
          onChange={(event) => onChange({ ...form, full_name: event.target.value })}
        />
        <Input
          aria-label="Pickup phone"
          placeholder="Phone"
          value={form.phone}
          onChange={(event) => onChange({ ...form, phone: event.target.value })}
        />
      </div>
      <CheckoutAddressLine1Field
        id="surfboard-shipped-line1"
        value={form.line1}
        onChange={(line1) => onChange({ ...form, line1 })}
        onAddressResolved={(address) =>
          onChange({
            ...form,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            postal_code: address.postal_code,
            country: "US",
          })
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          aria-label="Pickup city"
          placeholder="City"
          value={form.city}
          onChange={(event) => onChange({ ...form, city: event.target.value })}
        />
        <Input
          aria-label="Pickup state"
          placeholder="CA"
          value={form.state}
          onChange={(event) => onChange({ ...form, state: event.target.value })}
        />
        <Input
          aria-label="Pickup ZIP"
          placeholder="ZIP"
          value={form.postal_code}
          onChange={(event) => onChange({ ...form, postal_code: event.target.value })}
        />
      </div>
    </div>
  )
}

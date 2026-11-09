"use client"

import { useState } from "react"

import { SurfboardShippedAddPickup } from "@/components/features/sell/surfboard-shipped-pickup-form"
import { SurfboardShippedPickupMenu } from "@/components/features/sell/surfboard-shipped-pickup-menu"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { uniqueProfileAddresses, type ProfileAddressRow } from "@/lib/profile-address"

export type SurfboardShippedPickupForm = {
  full_name: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
  google_place_id: string
  latitude: number | null
  longitude: number | null
  formatted_address: string
}

function pickupIsChosen(form: SurfboardShippedPickupForm): boolean {
  return Boolean(
    form.full_name.trim() &&
      form.line1.trim() &&
      form.city.trim() &&
      form.state.trim() &&
      form.postal_code.trim(),
  )
}

function pickupPlaceLine(city: string, state: string, postalCode: string): string {
  const cityState = [city.trim(), state.trim()].filter(Boolean).join(", ")
  return [cityState, postalCode.trim()].filter(Boolean).join(" ")
}

function keepAddressSuggestions(event: { target: EventTarget | null; preventDefault: () => void }) {
  const target = event.target
  if (target instanceof Element && target.closest("[data-address-suggestions]")) {
    event.preventDefault()
  }
}

export function SurfboardShippedPickupFields({
  form,
  saved,
  selectedId,
  onPick,
  onChange,
}: {
  form: SurfboardShippedPickupForm
  saved: ProfileAddressRow[]
  selectedId: string | null
  onPick: (row: ProfileAddressRow) => void
  onChange: (next: SurfboardShippedPickupForm) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const chosen = pickupIsChosen(form)
  const options = uniqueProfileAddresses(saved, selectedId)

  return (
    <div className="space-y-2 pt-2">
      <p className="text-xs font-semibold text-foreground sm:text-sm">Pickup</p>
      <Popover
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open)
          if (!open) setAdding(false)
        }}
      >
        {chosen ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 sm:rounded-xl sm:px-3.5 sm:py-3">
            <div className="min-w-0 space-y-0.5 text-xs sm:text-sm">
              <p className="font-semibold text-foreground">{form.full_name}</p>
              {form.phone.trim() ? <p className="text-muted-foreground">{form.phone}</p> : null}
              <p className="text-foreground">{form.line1}</p>
              {form.line2.trim() ? <p className="text-foreground">{form.line2}</p> : null}
              <p className="text-foreground">{pickupPlaceLine(form.city, form.state, form.postal_code)}</p>
            </div>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs">
                Change
              </Button>
            </PopoverTrigger>
          </div>
        ) : (
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Choose pickup
            </Button>
          </PopoverTrigger>
        )}
        <PopoverContent
          align="start"
          className={adding ? "w-[min(28rem,calc(100vw-1.5rem))] p-3" : "w-80 p-2"}
          onInteractOutside={keepAddressSuggestions}
          onFocusOutside={keepAddressSuggestions}
        >
          {adding ? (
            <SurfboardShippedAddPickup
              onCancel={() => setAdding(false)}
              onConfirm={(next) => {
                onChange(next)
                setMenuOpen(false)
              }}
            />
          ) : (
            <SurfboardShippedPickupMenu
              options={options}
              selectedId={selectedId}
              onPick={(row) => {
                onPick(row)
                setMenuOpen(false)
              }}
              onAdd={() => setAdding(true)}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

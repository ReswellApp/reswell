"use client"

import { LocationPicker } from "@/components/location-picker"
import {
  FlatRate,
  ListingDeskBoardShipping,
  PackageCard,
} from "@/components/features/dashboard/listings/listing-desk-board-shipping"
import { SellShippingCostModeRadios } from "@/components/features/sell/sell-shipping-cost-mode-radios"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { listingAlwaysUsesReswellShipping } from "@/lib/apparel-listing-config"
import type { ListingDeskSpec } from "@/lib/listings-desk-fields"
import type { SellShippingCostMode } from "@/lib/sell-shipping-cost-mode"

const SHIP_ONLY = new Set(["fins", "wetsuits", "magazines"])

interface ListingDeskShippingProps {
  listingId: string
  section: string
  spec: ListingDeskSpec
  disabled: boolean
  onChange: (patch: Partial<ListingDeskSpec>) => void
}

export function ListingDeskShipping({
  listingId,
  section,
  spec,
  disabled,
  onChange,
}: ListingDeskShippingProps) {
  const shipOnly = SHIP_ONLY.has(section)
  const reswellOnly = section === "magazines" || listingAlwaysUsesReswellShipping(section)

  function setLocation(loc: { lat: number; lng: number; city: string; state: string; displayName: string }) {
    onChange({
      latitude: loc.lat,
      longitude: loc.lng,
      city: loc.city,
      state: loc.state,
      locationDisplay: loc.displayName,
    })
  }

  function setShipping(want: boolean) {
    let pickup = spec.localPickup
    if (!want && !pickup) pickup = true
    onChange({
      shippingAvailable: want,
      localPickup: pickup,
      ...(want ? {} : { shippingCostMode: "reswell" as const, shippingPrice: "" }),
    })
  }

  function setPickup(want: boolean) {
    let shipping = spec.shippingAvailable
    if (!want && !shipping) shipping = true
    onChange({ localPickup: want, shippingAvailable: shipping })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Shipping</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {section === "surfboards"
            ? "Buyers see your city for pickup. Pack and ship it yourself, or drop it off in a city we serve and we pack and ship it for you."
            : shipOnly
              ? "Pin where you're shipping from. These listings ship only — local pickup isn't available."
              : "Pin where you're listing from, then choose how buyers get it."}
        </p>
      </div>
      <LocationPicker
        key={
          spec.latitude != null && spec.longitude != null
            ? `loc-${spec.latitude.toFixed(5)}-${spec.longitude.toFixed(5)}`
            : "loc-empty"
        }
        onLocationSelect={setLocation}
        onLocationClear={() =>
          onChange({
            latitude: null,
            longitude: null,
            city: "",
            state: "",
            locationDisplay: "",
          })
        }
        initialLat={spec.latitude ?? undefined}
        initialLng={spec.longitude ?? undefined}
        initialCity={spec.city}
        initialState={spec.state}
        initialDisplay={spec.locationDisplay}
      />
      {section === "surfboards" ? (
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm sm:p-6">
          <ListingDeskBoardShipping listingId={listingId} spec={spec} disabled={disabled} onChange={onChange} />
        </div>
      ) : section === "magazines" ? (
        <PackageCard spec={spec} disabled={disabled} onChange={onChange} />
      ) : (
        <div className="space-y-4">
          {shipOnly ? null : (
            <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Delivery options</h3>
                <p className="mt-1 text-sm text-muted-foreground">You can select both options.</p>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`${listingId}-delivery-shipping`}
                  checked={spec.shippingAvailable}
                  disabled={disabled}
                  onCheckedChange={(value) => setShipping(value === true)}
                  className="mt-0.5"
                />
                <Label htmlFor={`${listingId}-delivery-shipping`} className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium leading-snug">
                  Shipping
                  <Badge variant="default" className="h-auto border-0 bg-listingHeart px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-[#2a4170]">
                    Items sell faster
                  </Badge>
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`${listingId}-delivery-pickup`}
                  checked={spec.localPickup}
                  disabled={disabled}
                  onCheckedChange={(value) => setPickup(value === true)}
                  className="mt-0.5"
                />
                <Label htmlFor={`${listingId}-delivery-pickup`} className="cursor-pointer pt-0.5 text-sm font-medium leading-snug">
                  Local pickup
                </Label>
              </div>
            </div>
          )}
          {spec.shippingAvailable && reswellOnly ? (
            <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <h3 className="text-sm font-semibold text-foreground">Reswell shipping</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Buyers pay a live rate at checkout. Reswell buys the label and adds tracking to your sale automatically.
              </p>
              <PackageCard spec={spec} disabled={disabled} onChange={onChange} />
            </div>
          ) : null}
          {(shipOnly || spec.shippingAvailable) && !reswellOnly ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <SellShippingCostModeRadios
                idPrefix={`${listingId}-ship`}
                value={spec.shippingCostMode}
                onChange={(mode: SellShippingCostMode) => onChange({ shippingCostMode: mode })}
                reswellDetails={{ originCity: spec.city, originState: spec.state }}
                reswellPackageSlot={<PackageCard spec={spec} disabled={disabled} onChange={onChange} />}
                flatRateSlot={
                  <FlatRate listingId={listingId} value={spec.shippingPrice} disabled={disabled} onChange={onChange} />
                }
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

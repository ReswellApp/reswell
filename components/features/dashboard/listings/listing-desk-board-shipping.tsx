"use client"

import { useEffect, useState, type ReactNode } from "react"
import { SellDropoffLocationCard } from "@/components/features/sell/sell-dropoff-location-card"
import { ReswellPackageDimensionsCard } from "@/components/features/sell/reswell-package-dimensions-card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SmoothCollapse } from "@/components/ui/smooth-collapse"
import { sellFormFieldsFromDropoffLocation } from "@/lib/dropoff-location-box-rules"
import type { PublicDropoffLocation } from "@/lib/dropoff-location-types"
import { normalizeTapeStyleInchesInput } from "@/lib/board-measurements"
import type { ListingDeskSpec } from "@/lib/listings-desk-fields"
import type { SellShippingCostMode } from "@/lib/sell-shipping-cost-mode"
import { cn } from "@/lib/utils"

interface ListingDeskBoardShippingProps {
  listingId: string
  spec: ListingDeskSpec
  disabled: boolean
  onChange: (patch: Partial<ListingDeskSpec>) => void
}

export function ListingDeskBoardShipping({
  listingId,
  spec,
  disabled,
  onChange,
}: ListingDeskBoardShippingProps) {
  const [locations, setLocations] = useState<PublicDropoffLocation[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [reload, setReload] = useState(0)
  const reswell = spec.shippingAvailable && spec.shippingCostMode === "reswell"
  const free = spec.shippingAvailable && spec.shippingCostMode === "free"
  const flat = spec.shippingAvailable && spec.shippingCostMode === "flat"

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    void fetch("/api/sell/dropoff-locations", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("dropoff")
        const json: unknown = await response.json()
        const rows =
          json && typeof json === "object" && "data" in json
            ? (json as { data?: { locations?: unknown } }).data?.locations
            : null
        if (!cancelled) {
          setLocations(Array.isArray(rows) ? (rows as PublicDropoffLocation[]) : [])
          setStatus("ready")
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  function applyOffer(enable: boolean, mode: SellShippingCostMode) {
    let shipping = enable
    let pickup = spec.localPickup
    if (!shipping && !pickup) pickup = true
    onChange({
      shippingAvailable: shipping,
      localPickup: pickup,
      shippingCostMode: enable ? mode : "reswell",
      ...(enable && mode === "flat" ? {} : { shippingPrice: "" }),
    })
  }

  function setPickup(want: boolean) {
    let shipping = spec.shippingAvailable
    if (!shipping && !want) shipping = true
    onChange({ localPickup: want, shippingAvailable: shipping })
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="min-w-0 space-y-0.5">
        <h3 className="text-sm font-semibold text-foreground sm:text-base">How will buyers get this board?</h3>
        <p className="text-xs text-muted-foreground sm:text-sm">You can offer shipping, local pickup, or both.</p>
      </div>
      <Offer
        id={`${listingId}-ship-reswell`}
        checked={reswell}
        disabled={disabled}
        onCheckedChange={(on) => applyOffer(on, "reswell")}
        label="Have Reswell calculate the shipping cost for buyers"
        recommended
      >
        <SmoothCollapse open={reswell}>
          <p className="pt-1 text-xs leading-snug text-muted-foreground sm:pt-2 sm:text-sm sm:leading-relaxed">
            {spec.dropoffLocationId
              ? "Buyers pay shipping at checkout. After it sells, drop the board at the location and we pack and ship it."
              : "Buyers pay shipping at checkout; we email you the UPS label. Enter the outer box size and weight you'll ship in."}
          </p>
        </SmoothCollapse>
        <SmoothCollapse open={reswell}>
          <div className="space-y-3 pt-2 sm:pt-3">
            <SellDropoffLocationCard
              locations={locations}
              selectedLocationId={spec.dropoffLocationId}
              boardLength={spec.boardLength}
              boardWidthInches={spec.boardWidth}
              status={status}
              onRetry={() => setReload((n) => n + 1)}
              onSelect={(locationId) => {
                const location = locations.find((row) => row.id === locationId)
                const fields = location
                  ? sellFormFieldsFromDropoffLocation(location, {
                      boardLength: spec.boardLength,
                      boardWidthInches: spec.boardWidth,
                    })
                  : null
                if (!fields) return
                onChange({
                  dropoffLocationId: fields.dropoffLocationId,
                  packageLengthIn: fields.reswellPackageLengthIn,
                  packageWidthIn: fields.reswellPackageWidthIn,
                  packageHeightIn: fields.reswellPackageHeightIn,
                  packageWeightLb: fields.reswellPackageWeightLb,
                  packageWeightOz: fields.reswellPackageWeightOz,
                })
              }}
              onClear={() => onChange({ dropoffLocationId: "" })}
            />
            {spec.dropoffLocationId && !spec.packageLengthIn ? null : (
              <PackageCard
                spec={spec}
                disabled={disabled}
                readOnly={Boolean(spec.dropoffLocationId)}
                exactCartonMode
                onChange={onChange}
              />
            )}
          </div>
        </SmoothCollapse>
      </Offer>
      <Offer
        id={`${listingId}-ship-free`}
        checked={free}
        disabled={disabled}
        onCheckedChange={(on) => applyOffer(on, "free")}
        label="Offer free shipping"
      >
        <SmoothCollapse open={free}>
          <p className="pt-0.5 text-xs leading-snug text-muted-foreground sm:pt-1 sm:text-sm sm:leading-relaxed">
            Buyer pays $0 for shipping at checkout. After the sale, buy a Reswell shipping label or add your own tracking.
          </p>
        </SmoothCollapse>
      </Offer>
      <Offer
        id={`${listingId}-ship-flat`}
        checked={flat}
        disabled={disabled}
        onCheckedChange={(on) => applyOffer(on, "flat")}
        label="Set a flat shipping rate"
      >
        <SmoothCollapse open={flat}>
          <div className="space-y-3 pt-1 sm:pt-2">
            <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">
              One dollar amount buyers in the Continental U.S. pay at checkout. After the sale, buy a Reswell shipping label or add your own tracking.
            </p>
            <FlatRate listingId={listingId} value={spec.shippingPrice} disabled={disabled} onChange={onChange} />
          </div>
        </SmoothCollapse>
      </Offer>
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-lg border p-3 sm:gap-3 sm:rounded-xl sm:p-5",
          spec.localPickup ? "border-foreground bg-background shadow-sm" : "border-border",
        )}
      >
        <Checkbox
          id={`${listingId}-ship-pickup`}
          checked={spec.localPickup}
          disabled={disabled}
          onCheckedChange={(value) => setPickup(value === true)}
          className="mt-0.5"
        />
        <Label htmlFor={`${listingId}-ship-pickup`} className="cursor-pointer pt-0.5 text-xs font-semibold leading-snug sm:text-sm">
          Local pickup
        </Label>
      </div>
    </div>
  )
}

function Offer({
  id,
  checked,
  disabled,
  onCheckedChange,
  label,
  recommended,
  children,
}: {
  id: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (on: boolean) => void
  label: string
  recommended?: boolean
  children?: ReactNode
}) {
  return (
    <div className={cn("rounded-lg border p-3 transition-colors sm:rounded-xl sm:p-5", checked ? "border-foreground bg-background shadow-sm" : "border-border")}>
      <div className="flex items-start gap-2.5 sm:gap-3">
        <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)} className="mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
          <Label htmlFor={id} className="flex cursor-pointer flex-wrap items-center gap-1.5 text-xs font-semibold leading-snug sm:gap-2 sm:text-sm">
            <span>{label}</span>
            {recommended ? (
              <Badge variant="default" className="h-auto border-0 bg-listingHeart px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide text-white hover:bg-[#2a4170] sm:px-2 sm:py-0.5 sm:text-[10px]">
                Recommended
              </Badge>
            ) : null}
          </Label>
          {children}
        </div>
      </div>
    </div>
  )
}

export function PackageCard({
  spec,
  disabled,
  readOnly,
  exactCartonMode,
  onChange,
}: {
  spec: ListingDeskSpec
  disabled: boolean
  readOnly?: boolean
  exactCartonMode?: boolean
  onChange: (patch: Partial<ListingDeskSpec>) => void
}) {
  return (
    <ReswellPackageDimensionsCard
      showHeading
      exactCartonMode={exactCartonMode}
      showCarrierAdjustmentNotice={exactCartonMode}
      readOnly={readOnly || disabled}
      lengthPlaceholder={exactCartonMode ? "0" : "e.g. 10"}
      className="border-0 bg-transparent p-0 shadow-none sm:border sm:bg-card sm:p-5 sm:shadow-sm"
      lengthIn={spec.packageLengthIn}
      widthIn={spec.packageWidthIn}
      heightIn={spec.packageHeightIn}
      weightLb={spec.packageWeightLb}
      weightOz={spec.packageWeightOz}
      onLengthInChange={(packageLengthIn) => onChange({ packageLengthIn: normalizeTapeStyleInchesInput(packageLengthIn) })}
      onWidthInChange={(packageWidthIn) => onChange({ packageWidthIn: normalizeTapeStyleInchesInput(packageWidthIn) })}
      onHeightInChange={(packageHeightIn) => onChange({ packageHeightIn: normalizeTapeStyleInchesInput(packageHeightIn) })}
      onWeightLbChange={(packageWeightLb) => onChange({ packageWeightLb })}
      onWeightOzChange={(packageWeightOz) => onChange({ packageWeightOz })}
    />
  )
}

export function FlatRate({
  listingId,
  value,
  disabled,
  onChange,
}: {
  listingId: string
  value: string
  disabled: boolean
  onChange: (patch: Partial<ListingDeskSpec>) => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-4 sm:p-5">
      <Label htmlFor={`${listingId}-shipping-price`} className="text-sm font-semibold text-foreground">
        Shipping price
      </Label>
      <div className="relative max-w-md">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm tabular-nums text-muted-foreground" aria-hidden>
          $
        </span>
        <Input
          id={`${listingId}-shipping-price`}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange({ shippingPrice: event.target.value })}
          className="h-11 border-foreground/20 bg-card pl-8 tabular-nums shadow-sm placeholder:text-muted-foreground"
        />
      </div>
    </div>
  )
}

"use client"

import { LocationPicker } from "@/components/location-picker"
import { SellFormSection } from "@/components/features/sell/sell-form-section"
import { SellShippingCostModeRadios } from "@/components/features/sell/sell-shipping-cost-mode-radios"
import { ReswellPackageDimensionsCard } from "@/components/features/sell/reswell-package-dimensions-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { normalizeTapeStyleInchesInput } from "@/lib/board-measurements"
import { sellShipOnlySectionDescription } from "@/lib/sell-section-fulfillment"
import type { SellShippingCostMode } from "@/lib/sell-shipping-cost-mode"

export type SellShipOnlyDeliveryFormSlice = {
  locationCity: string
  locationState: string
  locationLat: number | null
  locationLng: number | null
  locationDisplay: string
  shippingMode: SellShippingCostMode
  shippingPrice: string
  reswellPackageLengthIn: string
  reswellPackageWidthIn: string
  reswellPackageHeightIn: string
  reswellPackageWeightLb: string
  reswellPackageWeightOz: string
}

type SellShipOnlyDeliverySectionProps = {
  sectionId: string
  /** Sentence-case noun for copy, e.g. "Fin", "Boardbag". */
  productNoun: string
  idPrefix: string
  complete?: boolean
  form: SellShipOnlyDeliveryFormSlice
  onPatch: (patch: Partial<SellShipOnlyDeliveryFormSlice>) => void
  /** When true, hide Reswell / free / flat radios (apparel). */
  reswellCalculatedOnly?: boolean
  reswellCalculatedOnlyBlurb?: string
  reswellLengthPlaceholder?: string
}

export function SellShipOnlyDeliverySection({
  sectionId,
  productNoun,
  idPrefix,
  complete,
  form,
  onPatch,
  reswellCalculatedOnly = false,
  reswellCalculatedOnlyBlurb,
  reswellLengthPlaceholder = "e.g. 10",
}: SellShipOnlyDeliverySectionProps) {
  const flatPriceId = `${idPrefix}-shipping-price`

  return (
    <SellFormSection
      sectionId={sectionId}
      title="Shipping"
      description={sellShipOnlySectionDescription(productNoun)}
      complete={complete}
    >
      <div className="space-y-8">
        <LocationPicker
          initialLat={form.locationLat ?? undefined}
          initialLng={form.locationLng ?? undefined}
          initialCity={form.locationCity}
          initialState={form.locationState}
          initialDisplay={form.locationDisplay}
          onLocationSelect={(loc) => {
            onPatch({
              locationLat: loc.lat,
              locationLng: loc.lng,
              locationCity: loc.city,
              locationState: loc.state,
              locationDisplay: loc.displayName,
            })
          }}
          onLocationClear={() => {
            onPatch({
              locationLat: null,
              locationLng: null,
              locationCity: "",
              locationState: "",
              locationDisplay: "",
            })
          }}
        />

        {reswellCalculatedOnly ? (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h3 className="text-sm font-semibold text-foreground">Reswell shipping</h3>
            {reswellCalculatedOnlyBlurb ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{reswellCalculatedOnlyBlurb}</p>
            ) : null}
            <ReswellPackageDimensionsCard
              showHeading={false}
              className="rounded-lg border-border bg-background p-3 shadow-none sm:p-4"
              lengthIn={form.reswellPackageLengthIn}
              widthIn={form.reswellPackageWidthIn}
              heightIn={form.reswellPackageHeightIn}
              weightLb={form.reswellPackageWeightLb}
              weightOz={form.reswellPackageWeightOz}
              onLengthInChange={(v) =>
                onPatch({ reswellPackageLengthIn: normalizeTapeStyleInchesInput(v) })
              }
              onWidthInChange={(v) =>
                onPatch({ reswellPackageWidthIn: normalizeTapeStyleInchesInput(v) })
              }
              onHeightInChange={(v) =>
                onPatch({ reswellPackageHeightIn: normalizeTapeStyleInchesInput(v) })
              }
              onWeightLbChange={(v) => onPatch({ reswellPackageWeightLb: v })}
              onWeightOzChange={(v) => onPatch({ reswellPackageWeightOz: v })}
            />
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h3 className="text-sm font-semibold text-foreground">
              Shipping cost in the Continental U.S.{" "}
              <span className="text-destructive" aria-hidden>
                *
              </span>
            </h3>
            <SellShippingCostModeRadios
              idPrefix={idPrefix}
              value={form.shippingMode}
              onChange={(mode) => onPatch({ shippingMode: mode })}
              reswellDetails={{
                originCity: form.locationCity,
                originState: form.locationState,
              }}
              reswellPackageSlot={
                <ReswellPackageDimensionsCard
                  showHeading
                  lengthPlaceholder={reswellLengthPlaceholder}
                  className="rounded-lg border-border bg-background p-3 shadow-none sm:p-4"
                  lengthIn={form.reswellPackageLengthIn}
                  widthIn={form.reswellPackageWidthIn}
                  heightIn={form.reswellPackageHeightIn}
                  weightLb={form.reswellPackageWeightLb}
                  weightOz={form.reswellPackageWeightOz}
                  onLengthInChange={(v) =>
                    onPatch({ reswellPackageLengthIn: normalizeTapeStyleInchesInput(v) })
                  }
                  onWidthInChange={(v) =>
                    onPatch({ reswellPackageWidthIn: normalizeTapeStyleInchesInput(v) })
                  }
                  onHeightInChange={(v) =>
                    onPatch({ reswellPackageHeightIn: normalizeTapeStyleInchesInput(v) })
                  }
                  onWeightLbChange={(v) => onPatch({ reswellPackageWeightLb: v })}
                  onWeightOzChange={(v) => onPatch({ reswellPackageWeightOz: v })}
                />
              }
              flatRateSlot={
                <div className="space-y-2 rounded-lg border border-border bg-background p-4 sm:p-5">
                  <Label htmlFor={flatPriceId} className="text-sm font-semibold text-foreground">
                    Shipping rate{" "}
                    <span className="text-destructive" aria-hidden>
                      *
                    </span>
                  </Label>
                  <div className="relative max-w-md">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm tabular-nums text-muted-foreground"
                      aria-hidden
                    >
                      $
                    </span>
                    <Input
                      id={flatPriceId}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={form.shippingPrice}
                      onChange={(e) => onPatch({ shippingPrice: e.target.value })}
                      className="h-11 border-foreground/20 bg-card pl-8 tabular-nums shadow-sm placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              }
            />
          </div>
        )}
      </div>
    </SellFormSection>
  )
}

"use client"

import { Info, Plane, Truck } from "lucide-react"

import { LocalDateOnly } from "@/components/ui/local-datetime"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  AIR_CARGO_PICKUP_WITHIN_HOURS,
  AIR_CARGO_SERVICE_CODE,
  isAirCargoServiceCode,
} from "@/lib/shipping/air-cargo"
import type { PeerCheckoutShippingRateOption } from "@/lib/shipping/peer-checkout-usps-services"
import { cn } from "@/lib/utils"

interface CheckoutShippingMethodProps {
  rates: PeerCheckoutShippingRateOption[]
  selectedServiceCode: string | null
  groundShippingUsd: number | null
  groundUnavailableReason: string | null
  offersGroundRateChoice: boolean
  airport: string
  airportError: string | null
  onAirportChange: (value: string) => void
  onSelectAirCargo: () => void
  onSelectGround: () => void
  onSelectGroundService: (serviceCode: string) => void
}

function money(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function GroundArrival({ rate }: { rate: PeerCheckoutShippingRateOption }) {
  if (rate.estimatedDeliveryDate) {
    return (
      <>
        Arrives <LocalDateOnly iso={rate.estimatedDeliveryDate} dateStyle="medium" />
      </>
    )
  }
  if (rate.deliveryDays != null) {
    return (
      <>
        {rate.deliveryDays} business day{rate.deliveryDays === 1 ? "" : "s"}
      </>
    )
  }
  return <>Delivery estimate at checkout</>
}

export function CheckoutShippingMethod({
  rates,
  selectedServiceCode,
  groundShippingUsd,
  groundUnavailableReason,
  offersGroundRateChoice,
  airport,
  airportError,
  onAirportChange,
  onSelectAirCargo,
  onSelectGround,
  onSelectGroundService,
}: CheckoutShippingMethodProps) {
  const airCargo = rates.find((rate) => isAirCargoServiceCode(rate.serviceCode)) ?? null
  const groundRates = rates.filter((rate) => !isAirCargoServiceCode(rate.serviceCode))
  const airSelected = isAirCargoServiceCode(selectedServiceCode)
  const groundDisabled = groundRates.length === 0 && groundShippingUsd == null
  const selectedGround =
    groundRates.find((rate) => rate.serviceCode === selectedServiceCode) ?? groundRates[0] ?? null
  const groundPrice = airSelected
    ? (groundShippingUsd ?? selectedGround?.totalAmount ?? null)
    : (selectedGround?.totalAmount ?? groundShippingUsd)

  return (
    <div className="space-y-3">
      <Accordion type="multiple" className="space-y-2">
        <AccordionItem value="air-info" className="rounded-[8px] border border-b-0 border-neutral-200 bg-white px-4">
          <AccordionTrigger className="py-3 text-[14px] font-medium text-foreground hover:no-underline">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-neutral-500" aria-hidden />
              Air cargo shipping info
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-[13px] leading-relaxed text-neutral-600">
            One price for every surfboard size. The board flies to the international airport you name. You
            pick it up at the cargo office within {AIR_CARGO_PICKUP_WITHIN_HOURS} hours of landing — the
            office calls the phone number on this order, and we add the air waybill when it ships. Reswell
            does not cover late pickup fees.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="ground-info" className="rounded-[8px] border border-b-0 border-neutral-200 bg-white px-4">
          <AccordionTrigger className="py-3 text-[14px] font-medium text-foreground hover:no-underline">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-neutral-500" aria-hidden />
              Ground shipping info
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-[13px] leading-relaxed text-neutral-600">
            UPS or FedEx delivers to the address you entered. Choose a speed and the live rate for this board
            is added to your total.
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <RadioGroup
        value={airSelected ? AIR_CARGO_SERVICE_CODE : "ground"}
        onValueChange={(value) => {
          if (value === AIR_CARGO_SERVICE_CODE) onSelectAirCargo()
          else onSelectGround()
        }}
        className="overflow-hidden rounded-[8px] border border-neutral-200 bg-white"
      >
        {airCargo ? (
          <label
            htmlFor="checkout-method-air-cargo"
            className={cn(
              "flex cursor-pointer gap-3 border-b border-neutral-200 px-4 py-3.5",
              airSelected && "bg-[#5574AD]/[0.04]",
            )}
          >
            <RadioGroupItem id="checkout-method-air-cargo" value={AIR_CARGO_SERVICE_CODE} className="mt-1" />
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-3">
                <span className="flex items-start gap-2">
                  <Plane className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" aria-hidden />
                  <span>
                    <span className="block text-[14px] font-medium text-foreground">
                      Air cargo on all surfboard sizes
                    </span>
                    <span className="mt-0.5 block text-[12px] text-neutral-500">Airport pickup required</span>
                  </span>
                </span>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-foreground">
                  {money(airCargo.totalAmount)}
                </span>
              </span>
              <span className="mt-2 block text-[13px] leading-relaxed text-neutral-600">
                Name the nearest international airport. Pickup is required within {AIR_CARGO_PICKUP_WITHIN_HOURS}{" "}
                hours of landing.
              </span>
            </span>
          </label>
        ) : null}

        <label
          htmlFor="checkout-method-ground"
          className={cn(
            "flex gap-3 px-4 py-3.5",
            groundDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            !airSelected && !groundDisabled && "bg-[#5574AD]/[0.04]",
          )}
        >
          <RadioGroupItem
            id="checkout-method-ground"
            value="ground"
            disabled={groundDisabled}
            className="mt-1"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-3">
              <span className="flex items-start gap-2">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" aria-hidden />
                <span>
                  <span className="block text-[14px] font-medium text-foreground">Ground delivery</span>
                  <span className="mt-0.5 block text-[12px] text-neutral-500">To your address</span>
                </span>
              </span>
              {groundPrice != null ? (
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-foreground">
                  {money(groundPrice)}
                </span>
              ) : null}
            </span>
            {groundUnavailableReason ? (
              <span className="mt-2 block text-[13px] leading-relaxed text-destructive">
                Carrier delivery isn&apos;t available for this shipment. {groundUnavailableReason}
              </span>
            ) : (
              <span className="mt-2 block text-[13px] leading-relaxed text-neutral-600">
                {selectedGround
                  ? selectedGround.displayName
                  : "Live carrier rate for your address."}
                {selectedGround ? (
                  <>
                    {" "}
                    · <GroundArrival rate={selectedGround} />
                  </>
                ) : null}
              </span>
            )}
          </span>
        </label>
      </RadioGroup>

      {airSelected ? (
        <div className="space-y-2 rounded-[8px] border border-neutral-200 bg-white px-4 py-3.5">
          <Label htmlFor="checkout-air-cargo-airport" className="text-[13px] font-medium text-foreground">
            International airport <span className="text-destructive">*</span>
          </Label>
          <Input
            id="checkout-air-cargo-airport"
            value={airport}
            autoComplete="off"
            placeholder="LAX or Los Angeles International"
            maxLength={80}
            onChange={(event) => onAirportChange(event.target.value)}
            aria-invalid={airportError ? true : undefined}
            aria-describedby="checkout-air-cargo-airport-help"
          />
          <p
            id="checkout-air-cargo-airport-help"
            className={cn("text-[12px] leading-relaxed", airportError ? "text-destructive" : "text-neutral-500")}
          >
            {airportError ??
              `Once the board is packed we ship it to this airport. Pick it up within ${AIR_CARGO_PICKUP_WITHIN_HOURS} hours of landing. The cargo office will call when it is ready.`}
          </p>
        </div>
      ) : null}

      {!airSelected && offersGroundRateChoice && groundRates.length > 1 ? (
        <RadioGroup
          value={selectedGround?.serviceCode ?? ""}
          onValueChange={onSelectGroundService}
          className="space-y-2"
        >
          {groundRates.map((rate) => (
            <label
              key={rate.serviceCode}
              htmlFor={`checkout-ground-${rate.serviceCode}`}
              className="flex cursor-pointer items-start gap-3 rounded-[8px] border border-neutral-200 bg-white px-3.5 py-3 has-[[data-state=checked]]:border-[#5574AD]/40 has-[[data-state=checked]]:bg-[#5574AD]/[0.04]"
            >
              <RadioGroupItem
                id={`checkout-ground-${rate.serviceCode}`}
                value={rate.serviceCode}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-foreground">{rate.displayName}</span>
                <span className="mt-0.5 block text-[12px] text-neutral-500">
                  <GroundArrival rate={rate} />
                </span>
              </span>
              <span className="shrink-0 text-[14px] font-semibold tabular-nums text-foreground">
                {money(rate.totalAmount)}
              </span>
            </label>
          ))}
        </RadioGroup>
      ) : null}
    </div>
  )
}

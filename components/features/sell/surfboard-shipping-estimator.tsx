"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import type { AddressFields } from "@/app/admin/shipping/address-fields"
import {
  reswellSuggestedPackageInchesFromBoard,
  reswellSuggestedShipWeightLbOzFromBoard,
} from "@/lib/surfboard-shipping-estimates"
import { cn } from "@/lib/utils"

function shortServiceLabel(name: string): string {
  return name.replace(/®|™/g, "").trim()
}

type ZipGeocodeResult = {
  address_line1?: string
  city_locality?: string
  state_province?: string
  postal_code?: string
  error?: string
}

function addressFromZipGeocode(
  json: ZipGeocodeResult,
  role: "seller" | "buyer",
): AddressFields {
  return {
    name: role === "seller" ? "Seller" : "Buyer",
    phone: role === "buyer" ? "555-0100" : "",
    company_name: "",
    address_line1: json.address_line1 ?? "100 Main St",
    address_line2: "",
    city_locality: json.city_locality ?? "",
    state_province: json.state_province ?? "",
    postal_code: json.postal_code ?? "",
    country_code: "US",
    residential: role === "seller" ? "no" : "yes",
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function formatRouteHint(addr: AddressFields): string {
  const city = addr.city_locality.trim()
  const state = addr.state_province.trim()
  const zip = addr.postal_code.trim()
  if (city && state && zip) return `${city}, ${state} (${zip})`
  if (zip) return zip
  return "the receiver ZIP you entered"
}

type RateRow = {
  totalAmount: number
  currency: string
  carrierName: string
  carrierCode: string | null
  serviceName: string
  deliveryDays: number | null
  attributes: string[]
}

/** Flat inputs — thin border, rounded, no shadow */
const inputFlat =
  "h-11 rounded-lg border border-neutral-200 bg-white pr-10 text-sm shadow-none ring-0 ring-offset-0 transition-colors placeholder:text-neutral-400 focus-visible:border-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/10"

const labelBold = "text-xs font-bold text-foreground"

const tabTriggerClass =
  "relative rounded-none border-0 bg-transparent px-6 py-3 text-sm font-normal text-neutral-500 shadow-none ring-0 ring-offset-0 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-neutral-200 after:content-[''] focus-visible:ring-2 focus-visible:ring-neutral-900/15 data-[state=active]:font-bold data-[state=active]:text-foreground data-[state=active]:after:h-0.5 data-[state=active]:after:bg-foreground"

export type SurfboardShippingEstimatorListingContext = {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
}

export type SurfboardShippingEstimatorProps = {
  className?: string
  /** Prefix for input `id`s (must be unique per document). */
  idPrefix?: string
  /** When set, form resets whenever this becomes true (sell-flow dialog). */
  open?: boolean
  listingContext?: SurfboardShippingEstimatorListingContext
}

export function SurfboardShippingEstimator({
  className,
  idPrefix = "ship-est",
  open,
  listingContext,
}: SurfboardShippingEstimatorProps) {
  const boardLength = listingContext?.boardLength ?? ""
  const boardWidthInches = listingContext?.boardWidthInches ?? ""
  const boardThicknessInches = listingContext?.boardThicknessInches ?? ""
  const boardVolumeL = listingContext?.boardVolumeL ?? ""

  const [originZipDraft, setOriginZipDraft] = useState("")
  const [destinationZipDraft, setDestinationZipDraft] = useState("")
  const [routeHint, setRouteHint] = useState<string | null>(null)
  const [totalWeightLb, setTotalWeightLb] = useState("12")
  const [lengthIn, setLengthIn] = useState("72")
  const [widthIn, setWidthIn] = useState("20")
  const [heightIn, setHeightIn] = useState("6")
  const [busy, setBusy] = useState(false)
  const [rates, setRates] = useState<RateRow[] | null>(null)
  const openSignIn = useSignInGate()

  const applyListingSuggestions = useCallback(() => {
    const pkg = reswellSuggestedPackageInchesFromBoard({
      boardLength,
      boardWidthInches,
      boardThicknessInches,
    })
    const wt = reswellSuggestedShipWeightLbOzFromBoard({
      boardLength,
      boardVolumeL,
    })
    if (pkg) {
      if (pkg.lengthIn.trim()) setLengthIn(pkg.lengthIn)
      if (pkg.widthIn.trim()) setWidthIn(pkg.widthIn)
      if (pkg.heightIn.trim()) setHeightIn(pkg.heightIn)
    }
    if (wt) {
      const lbNum = parseInt(wt.lb, 10)
      const ozNum = parseInt(wt.oz, 10)
      const totalOz = lbNum * 16 + ozNum
      const lbs = totalOz / 16
      setTotalWeightLb(Number.isInteger(lbs) ? String(lbs) : lbs.toFixed(1))
    }
  }, [boardLength, boardWidthInches, boardThicknessInches, boardVolumeL])

  useEffect(() => {
    if (open === undefined) return
    if (!open) return
    setRates(null)
    setRouteHint(null)
    setOriginZipDraft("")
    setDestinationZipDraft("")
    applyListingSuggestions()
  }, [open, applyListingSuggestions])

  /** Top rates by price for the summary list (reference-style carrier rows). */
  const displayRates = useMemo(() => {
    if (!rates?.length) return []
    return [...rates].sort((a, b) => a.totalAmount - b.totalAmount).slice(0, 10)
  }, [rates])

  const resolveZipToAddress = async (
    zipDraft: string,
    role: "seller" | "buyer",
  ): Promise<AddressFields | null> => {
    const five = zipDraft.replace(/\D/g, "").slice(0, 5)
    if (five.length !== 5) return null

    let res: Response
    try {
      res = await fetchWithTimeout(
        `/api/geocode/us-zip?zip=${encodeURIComponent(five)}`,
        undefined,
        12_000,
      )
    } catch {
      return null
    }
    const json = (await res.json()) as ZipGeocodeResult
    if (!res.ok || !json.city_locality || !json.state_province || !json.postal_code) {
      return null
    }
    return addressFromZipGeocode(json, role)
  }

  const handleEstimate = async () => {
    setRates(null)
    setBusy(true)
    try {
      const [resolvedFrom, resolvedTo] = await Promise.all([
        resolveZipToAddress(originZipDraft, "seller"),
        resolveZipToAddress(destinationZipDraft, "buyer"),
      ])
      if (!resolvedFrom) {
        toast.error("Could not look up ship-from ZIP — check the code and try again.")
        return
      }
      if (!resolvedTo) {
        toast.error("Could not look up receiver ZIP — check the code and try again.")
        return
      }

      const lbs = parseFloat(totalWeightLb)
      if (!Number.isFinite(lbs) || lbs <= 0) {
        toast.error("Enter a valid total weight in pounds.")
        return
      }
      const weightOz = Math.max(1, Math.round(lbs * 16))
      if (weightOz > 960) {
        toast.error("Weight is too high for this estimator.")
        return
      }

      const l = Number(lengthIn)
      const w = Number(widthIn)
      const h = Number(heightIn)
      if (![l, w, h].every((n) => Number.isFinite(n) && n > 0)) {
        toast.error("Enter length, width, and height in inches.")
        return
      }

      let res: Response
      try {
        res = await fetchWithTimeout(
          "/api/shipping/estimate",
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              shipFrom: { ...resolvedFrom, country_code: "US" as const },
              shipTo: { ...resolvedTo, country_code: "US" as const },
              weightOz,
              lengthIn: l,
              widthIn: w,
              heightIn: h,
            }),
          },
          50_000,
        )
      } catch {
        toast.error("Shipping quote timed out — try again in a moment.")
        return
      }
      const json = (await res.json()) as { data?: { rates: RateRow[] }; error?: string }
      if (!res.ok) {
        if (res.status === 401) {
          openSignIn(null)
        } else {
          toast.error(json.error ?? "Could not get rates.")
        }
        return
      }
      const list = json.data?.rates ?? []
      if (list.length === 0) {
        toast.message("No rates returned — try different dimensions.")
      }
      setRouteHint(formatRouteHint(resolvedTo))
      setRates(list)
    } catch {
      toast.error("Something went wrong while fetching rates. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const zipFromId = `${idPrefix}-zip-from`
  const zipToId = `${idPrefix}-zip-to`
  const weightId = `${idPrefix}-weight`

  return (
    <Tabs defaultValue="domestic" className={cn("flex min-h-0 w-full flex-col", className)}>
      <div className="flex shrink-0 justify-center border-b border-neutral-200">
        <TabsList className="inline-flex h-auto gap-6 bg-transparent p-0">
          <TabsTrigger value="domestic" className={tabTriggerClass}>
            Domestic
          </TabsTrigger>
          <TabsTrigger value="international" className={tabTriggerClass}>
            International
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="domestic"
        className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden focus-visible:ring-0 data-[state=inactive]:hidden"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-8">
            <div className="space-y-2">
              <Label htmlFor={zipFromId} className={labelBold}>
                Your zip/postal code (ship from){" "}
                <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id={zipFromId}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="12345"
                maxLength={5}
                className={cn(inputFlat, "pr-3 font-mono tabular-nums")}
                value={originZipDraft}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 5)
                  setOriginZipDraft(v)
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={zipToId} className={labelBold}>
                Receiver&apos;s zip/postal code{" "}
                <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id={zipToId}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="90210"
                maxLength={5}
                className={cn(inputFlat, "pr-3 font-mono tabular-nums")}
                value={destinationZipDraft}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 5)
                  setDestinationZipDraft(v)
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={weightId} className={labelBold}>
                Total package weight <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <div className="relative">
                <Input
                  id={weightId}
                  inputMode="decimal"
                  className={cn(inputFlat)}
                  value={totalWeightLb}
                  onChange={(e) => setTotalWeightLb(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                  lb
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className={labelBold}>Package dimensions</p>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    [`${idPrefix}-l`, lengthIn, setLengthIn, "Length"],
                    [`${idPrefix}-w`, widthIn, setWidthIn, "Width"],
                    [`${idPrefix}-h`, heightIn, setHeightIn, "Height"],
                  ] as const
                ).map(([id, val, setVal, word]) => (
                  <div key={id} className="space-y-2">
                    <Label htmlFor={id} className={labelBold}>
                      {word} <span className="text-destructive" aria-hidden="true">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id={id}
                        inputMode="decimal"
                        aria-label={`${word} in inches`}
                        className={cn(inputFlat, "pr-8")}
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
                        in
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                disabled={busy}
                className="h-11 w-full rounded-full bg-foreground text-sm font-semibold text-background shadow-none hover:bg-foreground/90 dark:bg-white dark:text-black dark:hover:bg-neutral-100 sm:max-w-xs"
                onClick={() => void handleEstimate()}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Get estimate
              </Button>
            </div>
          </div>

          {displayRates.length > 0 ? (
            <div className="border-t border-neutral-200 bg-white px-6 py-5 sm:px-8 sm:py-6">
              <p className="text-xs leading-relaxed text-neutral-600">
                These figures are live carrier quotes for the weight and dimensions you entered, shipping to{" "}
                {routeHint ?? "the receiver ZIP you entered"}. Checkout label prices can differ by exact street
                addresses, surcharges, and packaging. Optional add-ons and extra coverage are not included.
              </p>
              <h4 className="mt-4 text-sm font-bold text-foreground">
                Sample rates for this package (lowest quotes first)
              </h4>
              <ul className="mt-3 space-y-0 divide-y divide-neutral-200">
                {displayRates.map((r, i) => (
                  <li
                    key={`${r.carrierCode ?? r.carrierName}-${r.serviceName}-${i}`}
                    className="flex items-start justify-between gap-4 py-3 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{r.carrierName}</p>
                      <p className="mt-0.5 text-xs leading-snug text-neutral-600">
                        {shortServiceLabel(r.serviceName)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                      {r.currency} {r.totalAmount.toFixed(2)}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-neutral-600">
                Buy your shipping label through Reswell when you sell to keep fulfillment in one place and use
                protections that apply to supported purchases.
              </p>
            </div>
          ) : null}
        </div>
      </TabsContent>

      <TabsContent
        value="international"
        className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-12 focus-visible:ring-0 sm:px-10"
      >
        <div className="mx-auto max-w-sm text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Coming soon</p>
          <h3 className="mt-2 text-base font-bold text-foreground">International shipping estimates</h3>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            We&apos;re building international label pricing for surfboards. For now, use the{" "}
            <span className="font-bold text-foreground">Domestic</span> tab to quote US shipments.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  )
}

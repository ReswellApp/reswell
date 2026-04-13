"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Anchor, Box, LayoutTemplate, Loader2, Ruler, Sailboat, Waves } from "lucide-react"
import { toast } from "sonner"
import type { AddressFields } from "@/app/admin/shipping/address-fields"
import {
  reswellSuggestedPackageInchesFromBoard,
  reswellSuggestedShipWeightLbOzFromBoard,
} from "@/lib/surfboard-shipping-estimates"
import { SAMPLE_DESTINATION_PRESETS } from "@/lib/shipping/estimate-destination-presets"
import { EXAMPLE_SURFBOARD_MEASUREMENTS } from "@/lib/shipping/example-surfboard-measurements"
import { cn } from "@/lib/utils"

const EXAMPLE_ICONS = [Waves, LayoutTemplate, Ruler, Sailboat, Box, Anchor] as const

function shortServiceLabel(name: string): string {
  return name.replace(/®|™/g, "").trim()
}

function sellerShipFrom(parts: {
  address_line1: string
  city_locality: string
  state_province: string
  postal_code: string
}): AddressFields {
  return {
    name: "Seller",
    phone: "",
    company_name: "",
    address_line1: parts.address_line1,
    address_line2: "",
    city_locality: parts.city_locality,
    state_province: parts.state_province,
    postal_code: parts.postal_code,
    country_code: "US",
    residential: "no",
  }
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

export function SurfboardShippingEstimatorDialog({
  open,
  onOpenChange,
  boardLength,
  boardWidthInches,
  boardThicknessInches,
  boardVolumeL,
  locationLat: _locationLat,
  locationLng: _locationLng,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
  /** Reserved for future “use listing location” flows */
  locationLat: number
  /** Reserved for future “use listing location” flows */
  locationLng: number
}) {
  void _locationLat
  void _locationLng

  const [originZipDraft, setOriginZipDraft] = useState("")
  const [totalWeightLb, setTotalWeightLb] = useState("12")
  const [lengthIn, setLengthIn] = useState("72")
  const [widthIn, setWidthIn] = useState("20")
  const [heightIn, setHeightIn] = useState("6")
  const [busy, setBusy] = useState(false)
  const [rates, setRates] = useState<RateRow[] | null>(null)

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
    if (!open) return
    setRates(null)
    setOriginZipDraft("")
    applyListingSuggestions()
  }, [open, applyListingSuggestions])

  /** Top rates by price for the summary list (reference-style carrier rows). */
  const displayRates = useMemo(() => {
    if (!rates?.length) return []
    return [...rates].sort((a, b) => a.totalAmount - b.totalAmount).slice(0, 10)
  }, [rates])

  const sampleRouteHint = useMemo(() => {
    const p = SAMPLE_DESTINATION_PRESETS[0]
    if (!p) return "a sample US destination"
    return `${p.label} (${p.description})`
  }, [])

  const resolveShipFromFromZip = async (): Promise<AddressFields | null> => {
    const five = originZipDraft.replace(/\D/g, "").slice(0, 5)
    if (five.length !== 5) return null

    const res = await fetch(`/api/geocode/us-zip?zip=${encodeURIComponent(five)}`)
    const json = (await res.json()) as {
      address_line1?: string
      city_locality?: string
      state_province?: string
      postal_code?: string
      error?: string
    }
    if (!res.ok || !json.city_locality || !json.state_province || !json.postal_code) {
      return null
    }
    return sellerShipFrom({
      address_line1: json.address_line1 ?? "100 Main St",
      city_locality: json.city_locality,
      state_province: json.state_province,
      postal_code: json.postal_code,
    })
  }

  const applyExampleMeasurements = (row: (typeof EXAMPLE_SURFBOARD_MEASUREMENTS)[number]) => {
    setTotalWeightLb(Number.isInteger(row.weightLb) ? String(row.weightLb) : row.weightLb.toFixed(1))
    setLengthIn(String(row.lengthIn))
    setWidthIn(String(row.widthIn))
    setHeightIn(String(row.heightIn))
  }

  const handleEstimate = async () => {
    setRates(null)
    setBusy(true)
    try {
      const resolved = await resolveShipFromFromZip()
      if (!resolved) {
        toast.error("Enter a valid 5-digit US ZIP code.")
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

      const shipTo = SAMPLE_DESTINATION_PRESETS[0]?.shipTo
      if (!shipTo) {
        toast.error("Estimator is not configured.")
        return
      }

      const res = await fetch("/api/shipping/estimate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipFrom: { ...resolved, country_code: "US" as const },
          shipTo: { ...shipTo, country_code: "US" as const },
          weightOz,
          lengthIn: l,
          widthIn: w,
          heightIn: h,
        }),
      })
      const json = (await res.json()) as { data?: { rates: RateRow[] }; error?: string }
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Sign in to get live shipping estimates.")
        } else {
          toast.error(json.error ?? "Could not get rates.")
        }
        return
      }
      const list = json.data?.rates ?? []
      if (list.length === 0) {
        toast.message("No rates returned — try different dimensions.")
      }
      setRates(list)
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const tabTriggerClass =
    "relative rounded-none border-0 bg-transparent px-6 py-3 text-sm font-normal text-neutral-500 shadow-none ring-0 ring-offset-0 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-neutral-200 after:content-[''] focus-visible:ring-2 focus-visible:ring-neutral-900/15 data-[state=active]:font-bold data-[state=active]:text-foreground data-[state=active]:after:h-0.5 data-[state=active]:after:bg-foreground"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92vh,900px)] max-w-[min(100vw-1.5rem,52rem)] flex-col gap-0 overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-none lg:max-w-5xl"
      >
        <DialogHeader className="shrink-0 space-y-0 border-0 px-10 pb-1 pt-8 text-center sm:px-14">
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
            Shipping label cost estimator
          </DialogTitle>
          <DialogDescription className="sr-only">
            Enter your US ZIP code, package weight, and dimensions to see a sample domestic label price.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="domestic" className="flex min-h-0 w-full flex-1 flex-col">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-12 lg:px-2">
                <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-8 lg:pr-4">
                <div className="space-y-2">
                  <Label htmlFor="sell-est-zip" className={labelBold}>
                    Your zip/postal code <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="sell-est-zip"
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
                  <Label htmlFor="sell-est-weight" className={labelBold}>
                    Total package weight <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="sell-est-weight"
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
                        ["sell-est-l", lengthIn, setLengthIn, "Length"],
                        ["sell-est-w", widthIn, setWidthIn, "Width"],
                        ["sell-est-h", heightIn, setHeightIn, "Height"],
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

                <div className="flex flex-col border-t border-neutral-200 bg-white lg:border-l lg:border-t-0">
                <div className="flex flex-col p-6 sm:p-8">
                  <div className="flex flex-col rounded-lg border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5">
                    <h3 className="mb-4 text-center text-sm font-bold text-foreground">
                      Example measurements
                    </h3>
                    <ul className="divide-y divide-neutral-200">
                      {EXAMPLE_SURFBOARD_MEASUREMENTS.map((row, i) => {
                        const Icon = EXAMPLE_ICONS[i % EXAMPLE_ICONS.length]
                        const line = row.summary.replace(/\s*—\s*/g, " - ")
                        return (
                          <li key={row.id} className="flex gap-3 py-4 first:pt-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center text-foreground">
                              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-foreground">{row.title}</p>
                              <p className="mt-1 text-xs leading-relaxed text-neutral-600">{line}</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-3 h-9 rounded-full border-neutral-300 bg-neutral-100 px-5 text-xs font-semibold text-foreground shadow-none hover:bg-neutral-200/80"
                                onClick={() => applyExampleMeasurements(row)}
                              >
                                Use measurements
                              </Button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
                </div>
              </div>

            {displayRates.length > 0 ? (
              <div className="border-t border-neutral-200 bg-white px-6 py-5 sm:px-8 sm:py-6">
                <p className="text-xs leading-relaxed text-neutral-600">
                  These figures are live carrier quotes for the weight and dimensions you entered, using a
                  sample buyer in {sampleRouteHint}. Checkout label prices can differ by exact addresses,
                  surcharges, and packaging. Optional add-ons and extra coverage are not included.
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
                  Buy your shipping label through Reswell when you sell to keep fulfillment in one place and
                  use protections that apply to supported orders.
                </p>
              </div>
            ) : null}
            </div>
          </TabsContent>

          <TabsContent
            value="international"
            className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-12 text-center focus-visible:ring-0 sm:px-10"
          >
            <p className="text-sm text-neutral-600">
              International estimates are not available yet. Open the{" "}
              <span className="font-bold text-foreground">Domestic</span> tab for US quotes.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
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
import { Loader2, Package } from "lucide-react"
import { toast } from "sonner"
import type { AddressFields } from "@/app/admin/shipping/address-fields"
import { AddressForm } from "@/app/admin/shipping/shipping-address-form"
import {
  reswellSuggestedPackageInchesFromBoard,
  reswellSuggestedShipWeightLbOzFromBoard,
} from "@/lib/surfboard-shipping-estimates"

const inputClass =
  "h-10 rounded-lg border-border/60 bg-background shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
const selectTriggerClass = "h-10 rounded-lg border-border/60 bg-background shadow-sm"

const emptyFrom: AddressFields = {
  name: "",
  phone: "",
  company_name: "",
  address_line1: "",
  address_line2: "",
  city_locality: "",
  state_province: "",
  postal_code: "",
  country_code: "US",
  residential: "no",
}

const emptyTo: AddressFields = {
  name: "",
  phone: "",
  company_name: "",
  address_line1: "",
  address_line2: "",
  city_locality: "",
  state_province: "",
  postal_code: "",
  country_code: "US",
  residential: "yes",
}

type RateRow = {
  totalAmount: number
  currency: string
  carrierName: string
  serviceName: string
  deliveryDays: number | null
}

export function SurfboardShippingEstimatorDialog({
  open,
  onOpenChange,
  boardLength,
  boardWidthInches,
  boardThicknessInches,
  boardVolumeL,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
}) {
  const [shipFrom, setShipFrom] = useState<AddressFields>(emptyFrom)
  const [shipTo, setShipTo] = useState<AddressFields>(emptyTo)
  const [weightLb, setWeightLb] = useState("12")
  const [weightOzPart, setWeightOzPart] = useState("0")
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
      setWeightLb(wt.lb)
      setWeightOzPart(wt.oz)
    }
  }, [boardLength, boardWidthInches, boardThicknessInches, boardVolumeL])

  useEffect(() => {
    if (!open) return
    setRates(null)
    applyListingSuggestions()
  }, [open, applyListingSuggestions])

  const handleEstimate = async () => {
    const lb = parseFloat(weightLb)
    const ozPart = parseFloat(weightOzPart)
    if (
      !Number.isFinite(lb) ||
      lb < 0 ||
      !Number.isFinite(ozPart) ||
      ozPart < 0 ||
      ozPart >= 16
    ) {
      toast.error("Enter a valid packed weight (pounds and whole ounces under 16).")
      return
    }
    const weightOz = lb * 16 + ozPart
    if (weightOz <= 0) {
      toast.error("Weight must be greater than zero.")
      return
    }

    const l = Number(lengthIn)
    const w = Number(widthIn)
    const h = Number(heightIn)
    if (![l, w, h].every((n) => Number.isFinite(n) && n > 0)) {
      toast.error("Enter box length, width, and height in inches.")
      return
    }

    setBusy(true)
    setRates(null)
    try {
      const res = await fetch("/api/shipping/estimate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipFrom: { ...shipFrom, country_code: "US" as const },
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
        toast.message("No rates returned — try different addresses or dimensions.")
      }
      setRates(list)
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[min(92vh,880px)] max-w-2xl overflow-y-auto gap-0 p-0 sm:max-w-2xl"
      >
        <div className="border-b border-border/60 px-6 py-5">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Package className="h-5 w-5 text-foreground/80" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="text-lg leading-snug">Surfboard shipping estimate</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  Enter where you ship from, a sample buyer ZIP in the continental U.S., and your packed box
                  size. We show the three best-priced options from live carrier rates (estimates only — final
                  cost may vary).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Tip: use outer box dimensions after padding, not just the board.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full text-xs"
              onClick={() => {
                applyListingSuggestions()
                toast.message("Filled from your listing measurements")
              }}
            >
              Use listing dimensions
            </Button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ship from (you)
              </h3>
              <AddressForm
                formId="sell-est-from"
                inputClassName={inputClass}
                selectTriggerClassName={selectTriggerClass}
                value={shipFrom}
                onChange={setShipFrom}
              />
            </div>
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ship to (example buyer)
              </h3>
              <AddressForm
                formId="sell-est-to"
                inputClassName={inputClass}
                selectTriggerClassName={selectTriggerClass}
                value={shipTo}
                onChange={setShipTo}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Packed box — weight & size
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Packed weight</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[5rem]">
                    <Input
                      inputMode="decimal"
                      className={inputClass}
                      value={weightLb}
                      onChange={(e) => setWeightLb(e.target.value)}
                      aria-label="Pounds"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      lb
                    </span>
                  </div>
                  <div className="relative flex-1 min-w-[5rem]">
                    <Input
                      inputMode="numeric"
                      className={inputClass}
                      value={weightOzPart}
                      onChange={(e) => setWeightOzPart(e.target.value)}
                      aria-label="Ounces"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      oz
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Dimensions (L × W × H in.)</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    className={`w-[4.5rem] ${inputClass}`}
                    inputMode="decimal"
                    placeholder="L"
                    value={lengthIn}
                    onChange={(e) => setLengthIn(e.target.value)}
                  />
                  <Input
                    className={`w-[4.5rem] ${inputClass}`}
                    inputMode="decimal"
                    placeholder="W"
                    value={widthIn}
                    onChange={(e) => setWidthIn(e.target.value)}
                  />
                  <Input
                    className={`w-[4.5rem] ${inputClass}`}
                    inputMode="decimal"
                    placeholder="H"
                    value={heightIn}
                    onChange={(e) => setHeightIn(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <Button
            type="button"
            className="w-full rounded-full sm:w-auto"
            disabled={busy}
            onClick={() => void handleEstimate()}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Get top 3 rates
          </Button>

          {rates && rates.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Best-priced options
              </h3>
              <ol className="space-y-2">
                {rates.map((r, i) => (
                  <li
                    key={`${r.carrierName}-${r.serviceName}-${i}`}
                    className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {r.currency} {r.totalAmount.toFixed(2)}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {r.carrierName} — {r.serviceName}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.deliveryDays != null
                          ? `About ${r.deliveryDays} business day${r.deliveryDays === 1 ? "" : "s"} transit (carrier estimate)`
                          : "Transit time varies"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      #{i + 1} best price
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

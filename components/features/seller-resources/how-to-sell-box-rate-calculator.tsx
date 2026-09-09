"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SurfboardShippingEstimatorPreset } from "@/components/features/sell/surfboard-shipping-estimator"
import type { OriginLaneQuote } from "@/lib/validations/origin-lane-shipping-estimate"
import { cn } from "@/lib/utils"

const inputFlat =
  "h-11 rounded-lg border border-neutral-200 bg-white pr-10 text-sm shadow-none ring-0 ring-offset-0 transition-colors placeholder:text-neutral-400 focus-visible:border-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/10"

const labelBold = "text-xs font-bold text-foreground"

function shortServiceLabel(name: string): string {
  return name.replace(/®|™/g, "").trim()
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

function LaneQuoteCard({
  title,
  quote,
}: {
  title: string
  quote: OriginLaneQuote | null
}) {
  return (
    <div className="rounded-2xl bg-[#F4F7FB] px-4 py-4 ring-1 ring-[#001A4A]/8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5574AD]">
        {title}
      </p>
      {quote ? (
        <>
          <p className="mt-2 font-headline text-2xl font-bold tabular-nums tracking-tight text-[#001A4A]">
            ${quote.totalAmount.toFixed(2)}
          </p>
          <p className="mt-1 text-sm font-medium text-[#001A4A]">{quote.sampleCityLabel}</p>
          <p className="mt-0.5 text-xs text-[#5c6b89]">
            {quote.carrierName} · {shortServiceLabel(quote.serviceName)}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-[#5c6b89]">No sample rate for this lane.</p>
      )}
    </div>
  )
}

export function HowToSellBoxRateCalculator({
  idPrefix = "how-to-sell-box-est",
  defaultLengthIn,
  defaultWidthIn,
  defaultHeightIn,
  defaultWeightLb,
  presets = [],
}: {
  idPrefix?: string
  defaultLengthIn: string
  defaultWidthIn: string
  defaultHeightIn: string
  defaultWeightLb: string
  presets?: SurfboardShippingEstimatorPreset[]
}) {
  const openSignIn = useSignInGate()
  const [originZipDraft, setOriginZipDraft] = useState("")
  const [totalWeightLb, setTotalWeightLb] = useState(defaultWeightLb)
  const [lengthIn, setLengthIn] = useState(defaultLengthIn)
  const [widthIn, setWidthIn] = useState(defaultWidthIn)
  const [heightIn, setHeightIn] = useState(defaultHeightIn)
  const [busy, setBusy] = useState(false)
  const [originLabel, setOriginLabel] = useState<string | null>(null)
  const [inState, setInState] = useState<OriginLaneQuote | null>(null)
  const [crossCountry, setCrossCountry] = useState<OriginLaneQuote | null>(null)
  const [hasResult, setHasResult] = useState(false)

  const clearQuotes = () => {
    setHasResult(false)
    setOriginLabel(null)
    setInState(null)
    setCrossCountry(null)
  }

  const handleEstimate = async () => {
    clearQuotes()
    setBusy(true)
    try {
      const five = originZipDraft.replace(/\D/g, "").slice(0, 5)
      if (five.length !== 5) {
        toast.error("Enter a 5-digit ship-from ZIP.")
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
          "/api/shipping/origin-lane-estimate",
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              originZip: five,
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

      const json = (await res.json()) as {
        data?: {
          originLabel: string
          inState: OriginLaneQuote | null
          crossCountry: OriginLaneQuote | null
        }
        error?: string
      }
      if (!res.ok) {
        if (res.status === 401) {
          openSignIn(null)
        } else {
          toast.error(json.error ?? "Could not get rates.")
        }
        return
      }

      setOriginLabel(json.data?.originLabel ?? null)
      setInState(json.data?.inState ?? null)
      setCrossCountry(json.data?.crossCountry ?? null)
      setHasResult(true)
    } catch {
      toast.error("Something went wrong while fetching rates. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const zipFromId = `${idPrefix}-zip-from`
  const weightId = `${idPrefix}-weight`

  return (
    <div className="flex w-full flex-col">
      <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-8">
        <div className="space-y-2">
          <Label htmlFor={zipFromId} className={labelBold}>
            Your zip/postal code (ship from){" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
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
          <Label htmlFor={weightId} className={labelBold}>
            Total package weight{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
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
          {presets.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => {
                const active =
                  lengthIn === preset.lengthIn &&
                  widthIn === preset.widthIn &&
                  heightIn === preset.heightIn
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-neutral-200 bg-white text-foreground hover:border-neutral-400",
                    )}
                    onClick={() => {
                      setLengthIn(preset.lengthIn)
                      setWidthIn(preset.widthIn)
                      setHeightIn(preset.heightIn)
                      if (preset.weightLb) setTotalWeightLb(preset.weightLb)
                      clearQuotes()
                    }}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          ) : null}
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
                  {word}{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
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

      {hasResult ? (
        <div className="border-t border-neutral-200 bg-white px-6 py-5 sm:px-8 sm:py-6">
          <p className="text-xs leading-relaxed text-neutral-600">
            Sample buyer labels from {originLabel ?? "your ZIP"} — one same-state city and one
            coast-to-coast city. Checkout can differ with the buyer&apos;s exact address.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <LaneQuoteCard title="Same state" quote={inState} />
            <LaneQuoteCard title="Coast to coast" quote={crossCountry} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

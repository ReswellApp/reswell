"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Calculator, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import {
  formatReswellBuyerShippingEstimateUsd,
  getReswellBuyerShippingEstimateUsd,
  getSurfboardShippingTier,
  RESWELL_BUYER_ESTIMATE_ZONE_LABELS,
  RESWELL_BUYER_ESTIMATE_ZONES,
  type ReswellBuyerEstimateZone,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"
import {
  getSurfboardShippingPackBand,
  parseSurfboardShippingPackBandId,
  type SurfboardShippingPackBandId,
} from "@/lib/surfboard-shipping-pack-bands"
import { cn } from "@/lib/utils"

type LiveQuote = {
  totalAmount: number
  currency: string
  carrierName: string
  serviceName: string
  sampleCityLabel: string
}

export type SurfboardBuyerShippingCalculatorProps = {
  className?: string
  /** Selected size tier — required to show dollar amounts. */
  tierId: SurfboardShippingTierId | ""
  /** Shortboard pack band — quotes that carton instead of Max. */
  packBandId?: SurfboardShippingPackBandId | ""
  /** Opens the full ZIP→ZIP ShipEngine estimator. */
  onOpenLiveEstimator?: () => void
}

function shortServiceLabel(name: string): string {
  return name.replace(/®|™/g, "").trim()
}

/**
 * Buyer-pays shipping calculator for Reswell-calculated mode.
 * Prefers a live ShipEngine sample quote (tier carton × ship-from ZIP × zone city);
 * falls back to static ballpark ranges when ZIP is missing or the API fails.
 */
export function SurfboardBuyerShippingCalculator({
  className,
  tierId,
  packBandId = "",
  onOpenLiveEstimator,
}: SurfboardBuyerShippingCalculatorProps) {
  const openSignIn = useSignInGate()
  const [zone, setZone] = useState<ReswellBuyerEstimateZone>("rest_of_us")
  const [originZip, setOriginZip] = useState("")
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [liveQuote, setLiveQuote] = useState<LiveQuote | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [allLive, setAllLive] = useState<Partial<Record<ReswellBuyerEstimateZone, LiveQuote>>>({})
  const [allBusy, setAllBusy] = useState(false)
  const requestSeq = useRef(0)

  const resolvedPackBandId = parseSurfboardShippingPackBandId(packBandId)
  const tierLabel = tierId ? getSurfboardShippingTier(tierId).label : null
  const packLabel =
    tierId === "shortboard" && resolvedPackBandId
      ? getSurfboardShippingPackBand(resolvedPackBandId).label
      : null
  const sizeLabel = packLabel ? `${tierLabel} · ${packLabel}` : tierLabel
  const zipReady = originZip.replace(/\D/g, "").length === 5

  const fallbackRange = useMemo(() => {
    if (!tierId) return null
    return getReswellBuyerShippingEstimateUsd(tierId, zone)
  }, [tierId, zone])

  useEffect(() => {
    if (!tierId || !zipReady) {
      setLiveQuote(null)
      setLiveError(null)
      setBusy(false)
      return
    }

    const seq = ++requestSeq.current
    const five = originZip.replace(/\D/g, "").slice(0, 5)
    const controller = new AbortController()
    setBusy(true)
    setLiveError(null)

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/shipping/buyer-zone-estimate", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              originZip: five,
              tierId,
              packBandId: resolvedPackBandId,
              zone,
            }),
          })
          const json = (await res.json()) as {
            data?: LiveQuote
            error?: string
          }
          if (seq !== requestSeq.current) return
          if (!res.ok) {
            if (res.status === 401) openSignIn(null)
            setLiveQuote(null)
            setLiveError(json.error ?? "Could not get a live sample rate.")
            return
          }
          if (!json.data) {
            setLiveQuote(null)
            setLiveError("Could not get a live sample rate.")
            return
          }
          setLiveQuote(json.data)
          setLiveError(null)
        } catch (err) {
          if (controller.signal.aborted) return
          if (seq !== requestSeq.current) return
          setLiveQuote(null)
          setLiveError("Could not reach shipping rates. Showing a ballpark instead.")
          void err
        } finally {
          if (seq === requestSeq.current) setBusy(false)
        }
      })()
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [tierId, resolvedPackBandId, zone, originZip, zipReady, openSignIn])

  const loadAllRegions = async () => {
    if (!tierId || !zipReady) {
      setShowAll((open) => !open)
      return
    }
    const nextOpen = !showAll
    setShowAll(nextOpen)
    if (!nextOpen) return

    const five = originZip.replace(/\D/g, "").slice(0, 5)
    setAllBusy(true)
    try {
      const results = await Promise.all(
        RESWELL_BUYER_ESTIMATE_ZONES.map(async (z) => {
          const res = await fetch("/api/shipping/buyer-zone-estimate", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              originZip: five,
              tierId,
              packBandId: resolvedPackBandId,
              zone: z,
            }),
          })
          const json = (await res.json()) as { data?: LiveQuote; error?: string }
          if (!res.ok || !json.data) return [z, null] as const
          return [z, json.data] as const
        }),
      )
      const map: Partial<Record<ReswellBuyerEstimateZone, LiveQuote>> = {}
      for (const [z, quote] of results) {
        if (quote) map[z] = quote
      }
      setAllLive(map)
    } finally {
      setAllBusy(false)
    }
  }

  if (!tierId) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-muted/15 px-4 py-3.5 sm:px-5",
          className,
        )}
      >
        <div className="flex gap-3">
          <Calculator
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground/45 leading-relaxed">
            Pick a shipping size above to see what buyers typically pay to have your board
            delivered.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-muted/15 p-4 sm:p-5 space-y-4",
        className,
      )}
    >
      <div className="flex gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"
          aria-hidden
        >
          <Calculator className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            Buyer shipping calculator
          </h3>
          <p className="text-sm text-muted-foreground/45 leading-relaxed">
            Live sample rates for your {sizeLabel} carton — same size checkout uses. Buyers pay
            the carrier total for their real address.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="sell-buyer-ship-from-zip" className="text-xs font-medium text-foreground">
            Your ship-from ZIP
          </Label>
          <Input
            id="sell-buyer-ship-from-zip"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="92109"
            maxLength={5}
            className="h-11 rounded-lg bg-background font-mono tabular-nums"
            value={originZip}
            onChange={(e) => setOriginZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sell-buyer-ship-zone" className="text-xs font-medium text-foreground">
            Sample buyer destination
          </Label>
          <Select
            value={zone}
            onValueChange={(next) => setZone(next as ReswellBuyerEstimateZone)}
          >
            <SelectTrigger id="sell-buyer-ship-zone" className="h-11 rounded-lg bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESWELL_BUYER_ESTIMATE_ZONES.map((z) => (
                <SelectItem key={z} value={z}>
                  {RESWELL_BUYER_ESTIMATE_ZONE_LABELS[z]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border/80 bg-background px-4 py-3.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/45">
            {liveQuote ? "Sample buyer pays" : "Buyer typically pays"}
          </p>
          {busy ? (
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              Getting live rate…
            </p>
          ) : liveQuote ? (
            <>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                ${liveQuote.totalAmount.toFixed(2)}
              </p>
              <p className="mt-1.5 text-sm text-foreground/80">
                {liveQuote.carrierName} · {shortServiceLabel(liveQuote.serviceName)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/45 leading-relaxed">
                Live carrier quote to {liveQuote.sampleCityLabel} from your ZIP, using the{" "}
                {sizeLabel} carton. Checkout can differ slightly with exact street addresses.
              </p>
            </>
          ) : fallbackRange ? (
            <>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {formatReswellBuyerShippingEstimateUsd(fallbackRange)}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground/45 leading-relaxed">
                {zipReady
                  ? liveError ??
                    "Live rate unavailable — showing a ballpark. Try again or use a ZIP quote."
                  : "Enter your ship-from ZIP for a live sample rate on this lane."}
              </p>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <button
            type="button"
            className="text-sm font-medium text-foreground underline underline-offset-2 hover:text-primary"
            onClick={() => void loadAllRegions()}
          >
            {showAll ? "Hide all regions" : "See all regions"}
          </button>
          {onOpenLiveEstimator ? (
            <button
              type="button"
              className="text-sm font-medium text-foreground underline underline-offset-2 hover:text-primary"
              onClick={onOpenLiveEstimator}
            >
              Quote a specific buyer ZIP
            </button>
          ) : null}
        </div>

        {showAll ? (
          <div className="overflow-x-auto rounded-lg border border-border/80 bg-background px-4 py-3.5">
            {allBusy ? (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading live rates for each region…
              </p>
            ) : (
              <table className="w-full min-w-[280px] text-sm">
                <tbody>
                  {RESWELL_BUYER_ESTIMATE_ZONES.map((z) => {
                    const live = allLive[z]
                    const range = getReswellBuyerShippingEstimateUsd(tierId, z)
                    return (
                      <tr key={z} className="border-b border-border/50 last:border-0">
                        <td className="py-1.5 pr-4 text-muted-foreground/70">
                          {RESWELL_BUYER_ESTIMATE_ZONE_LABELS[z]}
                        </td>
                        <td className="py-1.5 text-right font-medium tabular-nums text-foreground">
                          {live
                            ? `$${live.totalAmount.toFixed(2)}`
                            : formatReswellBuyerShippingEstimateUsd(range)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {!zipReady ? (
              <p className="mt-2 text-xs text-muted-foreground/45">
                Add your ship-from ZIP above to replace ballparks with live sample rates.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

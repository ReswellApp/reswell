"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Package, RefreshCw, Truck } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ReswellPackageDimensionsCard } from "@/components/features/sell/reswell-package-dimensions-card"
import { normalizeBoardLengthInput } from "@/lib/board-measurements"
import {
  parseReswellPackedWeightToTotalOz,
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
} from "@/lib/reswell-parcel-fields"
import { validateLabelParcelEntry } from "@/lib/shipping/surfboard-label-limits"
import { cn } from "@/lib/utils"

type RateOption = {
  rate_id: string
  carrierLabel: string
  serviceName: string
  amount: number
  currency: string
}

type Overview = {
  eligible: boolean
  ineligibleReasons: string[]
  shipEngineConfigured: boolean
  hasExistingLabel: boolean
  order: {
    id: string
    displayOrderNum: string
    listingTitle: string
    deliveryStatus: string
    trackingNumber: string | null
    trackingCarrier: string | null
  }
  buyerAddressSummary: string | null
  shipFromSource: "seller" | "admin"
  shipFromAddresses: Array<{
    id: string
    label: string
    oneLine: string
    isDefault: boolean
  }>
}

function money(amount: number, currency: string): string {
  const c = currency?.toUpperCase() || "USD"
  if (c === "USD") return `$${amount.toFixed(2)}`
  return `${amount.toFixed(2)} ${c}`
}

function parseExactParcel(fields: {
  lengthIn: string
  widthIn: string
  heightIn: string
  weightLb: string
  weightOz: string
}):
  | { ok: true; parcel: { length_in: number; width_in: number; height_in: number; weight_lb: number } }
  | { ok: false; error: string } {
  const lengthIn = parseReswellParcelLengthRawToCarrierInches(fields.lengthIn)
  const widthIn = parseReswellParcelWidthHeightRawToCarrierInches(fields.widthIn)
  const heightIn = parseReswellParcelWidthHeightRawToCarrierInches(fields.heightIn)
  const totalOz = parseReswellPackedWeightToTotalOz(fields.weightLb, fields.weightOz)
  if (lengthIn == null) {
    return { ok: false, error: "Enter packed length (e.g. 6'1 or outer inches)." }
  }
  if (widthIn == null) {
    return { ok: false, error: "Enter packed width in inches." }
  }
  if (heightIn == null) {
    return { ok: false, error: "Enter packed height in inches." }
  }
  if (totalOz == null) {
    return { ok: false, error: "Enter packed weight in pounds and ounces." }
  }
  const weightLb = totalOz / 16
  const check = validateLabelParcelEntry({ lengthIn, widthIn, heightIn, weightLb })
  if (!check.ok) return { ok: false, error: check.error }
  return {
    ok: true,
    parcel: {
      length_in: lengthIn,
      width_in: widthIn,
      height_in: heightIn,
      weight_lb: weightLb,
    },
  }
}

export function AdminReplaceOrderShippingLabelPanel({
  orderId,
  canReplace,
  onComplete,
  className,
}: {
  orderId: string
  canReplace: boolean
  onComplete?: () => void
  className?: string
}) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lengthIn, setLengthIn] = useState("")
  const [widthIn, setWidthIn] = useState("")
  const [heightIn, setHeightIn] = useState("")
  const [weightLb, setWeightLb] = useState("")
  const [weightOz, setWeightOz] = useState("")
  const [shipFromAddressId, setShipFromAddressId] = useState<string>("")
  const [rates, setRates] = useState<RateOption[] | null>(null)
  const [selectedRateId, setSelectedRateId] = useState("")
  const [ratesBusy, setRatesBusy] = useState(false)
  const [purchaseBusy, setPurchaseBusy] = useState(false)
  const [quoteMeta, setQuoteMeta] = useState<{
    shipFromSummary: string
    shipToSummary: string
  } | null>(null)

  const loadOverview = useCallback(async () => {
    if (!orderId || !canReplace) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/replace-shipping-label`,
        { credentials: "include" },
      )
      const body = (await res.json()) as { data?: Overview; error?: string }
      if (!res.ok || !body.data) {
        setLoadError(body.error ?? "Could not load label replace tool")
        setOverview(null)
        return
      }
      setOverview(body.data)
      const preferred =
        body.data.shipFromAddresses.find((a) => a.isDefault)?.id ??
        body.data.shipFromAddresses[0]?.id ??
        ""
      setShipFromAddressId(preferred)
    } catch {
      setLoadError("Could not load label replace tool")
      setOverview(null)
    } finally {
      setLoading(false)
    }
  }, [orderId, canReplace])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const parcelParse = useMemo(
    () => parseExactParcel({ lengthIn, widthIn, heightIn, weightLb, weightOz }),
    [lengthIn, widthIn, heightIn, weightLb, weightOz],
  )

  async function getRates() {
    if (!overview) return
    if (!parcelParse.ok) {
      toast.error(parcelParse.error)
      return
    }
    setRatesBusy(true)
    setRates(null)
    setSelectedRateId("")
    setQuoteMeta(null)
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/replace-shipping-label`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rates",
            parcel: parcelParse.parcel,
            ship_from_address_id: shipFromAddressId || undefined,
          }),
        },
      )
      const body = (await res.json()) as {
        data?: {
          rates: RateOption[]
          shipFromSummary: string
          shipToSummary: string
          shipFromSource: "seller" | "admin"
        }
        error?: string
      }
      if (!res.ok || !body.data?.rates) {
        toast.error(body.error ?? "Could not get UPS rates")
        return
      }
      setRates(body.data.rates)
      setQuoteMeta({
        shipFromSummary: body.data.shipFromSummary,
        shipToSummary: body.data.shipToSummary,
      })
      if (body.data.rates[0]?.rate_id) {
        setSelectedRateId(body.data.rates[0].rate_id)
      }
    } catch {
      toast.error("Could not get UPS rates")
    } finally {
      setRatesBusy(false)
    }
  }

  async function buyReplacement() {
    if (!overview || !selectedRateId) return
    if (!parcelParse.ok) {
      toast.error(parcelParse.error)
      return
    }
    const selected = rates?.find((r) => r.rate_id === selectedRateId)
    const confirmMsg = overview.hasExistingLabel
      ? `Void the current label (refund when carrier approves) and buy a new UPS label for ${selected ? money(selected.amount, selected.currency) : "the selected rate"}? Reswell pays for the new label.`
      : `Buy a new UPS label for ${selected ? money(selected.amount, selected.currency) : "the selected rate"}? Reswell pays for this label.`
    if (!window.confirm(confirmMsg)) return

    setPurchaseBusy(true)
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/replace-shipping-label`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "purchase",
            parcel: parcelParse.parcel,
            rate_id: selectedRateId,
            ship_from_address_id: shipFromAddressId || undefined,
          }),
        },
      )
      const body = (await res.json()) as {
        data?: {
          trackingNumber: string
          trackingCarrier: string | null
          liveQuoteUsd: number | null
          carrierLabel: string
          serviceName: string
          voidResult: {
            attempted: boolean
            approved: boolean | null
            message: string | null
            error: string | null
          }
        }
        error?: string
      }
      if (!res.ok || !body.data) {
        toast.error(body.error ?? "Could not buy replacement label")
        return
      }

      const voidNote = body.data.voidResult
      if (voidNote.attempted && voidNote.error) {
        toast.warning(
          `New label bought (${body.data.trackingNumber}). Prior label void failed: ${voidNote.error}`,
        )
      } else if (voidNote.attempted && voidNote.approved === false) {
        toast.success(
          `New label ${body.data.trackingNumber}. Prior label void pending carrier approval.`,
        )
      } else {
        toast.success(
          `UPS label purchased — tracking ${body.data.trackingNumber} (${body.data.carrierLabel} ${body.data.serviceName}).`,
        )
      }
      setRates(null)
      setSelectedRateId("")
      onComplete?.()
      void loadOverview()
    } catch {
      toast.error("Could not buy replacement label")
    } finally {
      setPurchaseBusy(false)
    }
  }

  if (!canReplace) return null

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading exact-box label tool…
      </div>
    )
  }

  if (loadError || !overview) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTitle>Exact box label</AlertTitle>
        <AlertDescription>{loadError ?? "Unavailable"}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={cn("space-y-4 rounded-xl border border-border/60 p-4", className)}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <Package className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Exact box — replace UPS label
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enter measured outer L×W×H and weight, get live UPS rates for this order&apos;s
            addresses, void the old label, and buy a new one. Reswell pays for the replacement;
            the order tracking and label download update to the new label.
          </p>
        </div>
      </div>

      {!overview.eligible ? (
        <Alert>
          <AlertTitle>Not ready</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              {overview.ineligibleReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {overview.hasExistingLabel ? (
        <p className="text-xs text-muted-foreground">
          Current tracking:{" "}
          <span className="font-mono text-foreground">
            {overview.order.trackingNumber}
          </span>
          {overview.order.trackingCarrier
            ? ` · ${overview.order.trackingCarrier}`
            : null}
          . Buying a replacement will void this label (refund when the carrier approves — you can
          still buy if void is pending).
        </p>
      ) : null}

      {overview.buyerAddressSummary ? (
        <p className="text-xs text-muted-foreground">
          Ship to: <span className="text-foreground">{overview.buyerAddressSummary}</span>
        </p>
      ) : null}

      {overview.shipFromSource === "admin" ? (
        <Alert>
          <AlertTitle>Using admin ship-from</AlertTitle>
          <AlertDescription>
            This seller has no ship-from address on file, so rates and the new label use your admin
            profile address.
          </AlertDescription>
        </Alert>
      ) : null}

      {overview.shipFromAddresses.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="replace-label-ship-from" className="text-sm font-medium">
            {overview.shipFromSource === "admin" ? "Admin ship from" : "Seller ship from"}
          </Label>
          <Select value={shipFromAddressId} onValueChange={setShipFromAddressId}>
            <SelectTrigger id="replace-label-ship-from" className="w-full">
              <SelectValue placeholder="Ship-from address" />
            </SelectTrigger>
            <SelectContent>
              {overview.shipFromAddresses.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                  {a.isDefault ? " (default)" : ""} — {a.oneLine}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : overview.shipFromAddresses[0] ? (
        <p className="text-xs text-muted-foreground">
          {overview.shipFromSource === "admin" ? "Admin ship from" : "Seller ship from"}:{" "}
          <span className="text-foreground">{overview.shipFromAddresses[0].oneLine}</span>
        </p>
      ) : null}

      <ReswellPackageDimensionsCard
        exactCartonMode
        showHeading
        lengthPlaceholder="e.g. 6'1 or 73"
        lengthIn={lengthIn}
        widthIn={widthIn}
        heightIn={heightIn}
        weightLb={weightLb}
        weightOz={weightOz}
        onLengthInChange={(v) => setLengthIn(normalizeBoardLengthInput(v))}
        onWidthInChange={setWidthIn}
        onHeightInChange={setHeightIn}
        onWeightLbChange={setWeightLb}
        onWeightOzChange={setWeightOz}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-2"
          disabled={!overview.eligible || ratesBusy || purchaseBusy || !parcelParse.ok}
          onClick={() => void getRates()}
        >
          {ratesBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {ratesBusy ? "Getting UPS rates…" : "Get UPS rates"}
        </Button>
      </div>

      {quoteMeta ? (
        <p className="text-xs text-muted-foreground">
          Quoted {quoteMeta.shipFromSummary} → {quoteMeta.shipToSummary}
        </p>
      ) : null}

      {rates && rates.length > 0 ? (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Carrier</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((r) => (
                <TableRow
                  key={r.rate_id}
                  className={cn(
                    "cursor-pointer",
                    selectedRateId === r.rate_id && "bg-muted/50",
                  )}
                  onClick={() => setSelectedRateId(r.rate_id)}
                >
                  <TableCell>
                    <input
                      type="radio"
                      name="replace-ups-rate"
                      checked={selectedRateId === r.rate_id}
                      onChange={() => setSelectedRateId(r.rate_id)}
                      aria-label={`${r.carrierLabel} ${r.serviceName}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{r.carrierLabel}</TableCell>
                  <TableCell>{r.serviceName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(r.amount, r.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Button
            type="button"
            size="sm"
            className="gap-2"
            disabled={!selectedRateId || purchaseBusy || ratesBusy}
            onClick={() => void buyReplacement()}
          >
            {purchaseBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Truck className="h-4 w-4" />
            )}
            {purchaseBusy
              ? "Buying label…"
              : overview.hasExistingLabel
                ? "Void old & buy new UPS label"
                : "Buy UPS label (Reswell pays)"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

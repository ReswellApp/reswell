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
import type { AddressFields } from "@/app/admin/shipping/address-fields"
import { AddressForm } from "@/app/admin/shipping/shipping-address-form"
import { normalizeBoardLengthInput } from "@/lib/board-measurements"
import { adminUserShippingLabelShipToSchema } from "@/lib/validations/adminUserShippingLabel"
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
  shipTo: AddressFields | null
  warnings: string[]
  suggestedParcel: {
    lengthIn: string
    widthIn: string
    heightIn: string
    weightLb: string
    weightOz: string
    ruleLabel: string
  } | null
  shipFromSource: "seller" | "admin" | "dropoff"
  shipFromAddresses: Array<{
    id: string
    label: string
    oneLine: string
    isDefault: boolean
    fields: AddressFields
  }>
}

const EMPTY_ADDRESS: AddressFields = {
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

const ADDRESS_FIELD_LABEL: Record<string, string> = {
  name: "name",
  address_line1: "street address",
  city_locality: "city",
  state_province: "state",
  postal_code: "postal code",
  country_code: "country",
}

function firstAddressError(fields: AddressFields, label: string): string | null {
  const parsed = adminUserShippingLabelShipToSchema.safeParse(fields)
  if (parsed.success) return null
  const key = parsed.error.issues[0]?.path[0]
  const field = typeof key === "string" ? (ADDRESS_FIELD_LABEL[key] ?? "address") : "address"
  return `${label}: enter a valid ${field}.`
}

function addressOneLine(fields: AddressFields): string {
  return [fields.address_line1, [fields.city_locality, fields.state_province, fields.postal_code].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ")
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
  const [shipFrom, setShipFrom] = useState<AddressFields>(EMPTY_ADDRESS)
  const [shipTo, setShipTo] = useState<AddressFields>(EMPTY_ADDRESS)
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
      setShipFrom(
        body.data.shipFromAddresses.find((a) => a.id === preferred)?.fields ?? EMPTY_ADDRESS,
      )
      setShipTo(body.data.shipTo ?? EMPTY_ADDRESS)
      const parcel = body.data.suggestedParcel
      if (parcel) {
        setLengthIn(parcel.lengthIn)
        setWidthIn(parcel.widthIn)
        setHeightIn(parcel.heightIn)
        setWeightLb(parcel.weightLb)
        setWeightOz(parcel.weightOz)
      }
      setRates(null)
      setSelectedRateId("")
      setQuoteMeta(null)
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
  const shipFromError = useMemo(() => firstAddressError(shipFrom, "Ship from"), [shipFrom])
  const shipToError = useMemo(() => firstAddressError(shipTo, "Ship to"), [shipTo])

  function clearQuotedRates() {
    setRates(null)
    setSelectedRateId("")
    setQuoteMeta(null)
  }

  async function getRates() {
    if (!overview) return
    if (!parcelParse.ok) {
      toast.error(parcelParse.error)
      return
    }
    if (shipFromError) {
      toast.error(shipFromError)
      return
    }
    if (shipToError) {
      toast.error(shipToError)
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
            ship_from: shipFrom,
            ship_to: shipTo,
          }),
        },
      )
      const body = (await res.json()) as {
        data?: {
          rates: RateOption[]
          shipFromSummary: string
          shipToSummary: string
          shipFromSource: "seller" | "admin" | "dropoff"
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
    if (shipFromError || shipToError) {
      toast.error(shipFromError ?? shipToError ?? "Enter both addresses.")
      return
    }
    const selected = rates?.find((r) => r.rate_id === selectedRateId)
    const destination = addressOneLine(shipTo)
    const price = selected ? money(selected.amount, selected.currency) : "the selected rate"
    const confirmMsg = overview.hasExistingLabel
      ? `Void the current label (refund when carrier approves) and buy a new UPS label to ${destination} for ${price}? The order shipping address updates to this ship-to. Reswell pays for the new label.`
      : `Buy a new UPS label to ${destination} for ${price}? The order shipping address updates to this ship-to. Reswell pays for this label.`
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
            ship_from: shipFrom,
            ship_to: shipTo,
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
          shippingAddressSaved?: boolean
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
      if (body.data.shippingAddressSaved === false) {
        toast.warning(
          "The new label was purchased, but the order shipping address was not saved. Refresh and confirm the ship-to before buying another label.",
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
            {overview.shipFromSource === "dropoff"
              ? "Santa Barbara drop-off label"
              : "Exact box — replace UPS label"}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {overview.shipFromSource === "dropoff"
              ? overview.suggestedParcel
                ? `Box from the Santa Barbara drop-off rules (${overview.suggestedParcel.ruleLabel}). Buy the label from that location. It is saved on this order for admin. The seller does not get the file.`
                : "This order uses the Santa Barbara drop-off. Buy the label from that location with the location box size. The seller does not get the file."
              : "Edit the ship-from or ship-to address, or the measured box size. Get live UPS rates, void the old label, and buy a new one. The order's shipping address updates to the ship-to you enter. Reswell pays for the replacement."}
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

      {(overview.warnings ?? []).length > 0 ? (
        <Alert>
          <AlertTitle>Check the addresses</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              {(overview.warnings ?? []).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {overview.shipFromSource === "dropoff" ? (
        <Alert>
          <AlertTitle>Ships from Santa Barbara</AlertTitle>
          <AlertDescription>
            Origin is the drop-off, not the seller&apos;s home address.
            {overview.suggestedParcel
              ? ` Carton ${overview.suggestedParcel.lengthIn} × ${overview.suggestedParcel.widthIn} × ${overview.suggestedParcel.heightIn} in, ${overview.suggestedParcel.weightLb} lb.`
              : ""}
          </AlertDescription>
        </Alert>
      ) : null}

      {overview.shipFromSource === "admin" && overview.shipFromAddresses.length > 0 ? (
        <Alert>
          <AlertTitle>Using admin ship-from</AlertTitle>
          <AlertDescription>
            This seller has no ship-from address on file. The form starts from your admin profile
            address. Edit it before you get rates if the origin should be different.
          </AlertDescription>
        </Alert>
      ) : null}

      {overview.shipFromAddresses.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="replace-label-ship-from-saved" className="text-sm font-medium">
            {overview.shipFromSource === "dropoff"
              ? "Ship from"
              : overview.shipFromSource === "admin"
                ? "Saved admin ship from"
                : "Saved seller ship from"}
          </Label>
          <Select
            value={shipFromAddressId}
            onValueChange={(id) => {
              setShipFromAddressId(id)
              const match = overview.shipFromAddresses.find((a) => a.id === id)
              if (match) setShipFrom(match.fields)
              clearQuotedRates()
            }}
          >
            <SelectTrigger id="replace-label-ship-from-saved" className="w-full">
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
      ) : null}

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Ship from</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Printed as the label origin. Editing this does not change the seller&apos;s saved address.
          </p>
        </div>
        <AddressForm
          value={shipFrom}
          onChange={(next) => {
            setShipFrom(next)
            clearQuotedRates()
          }}
          inputClassName="h-10"
          selectTriggerClassName="h-10"
          formId="replace-label-ship-from"
        />
        {shipFromError ? <p className="text-xs text-destructive">{shipFromError}</p> : null}
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Ship to</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Saved on this order when the new label is purchased.
            {overview.buyerAddressSummary
              ? ` Current order address: ${overview.buyerAddressSummary}.`
              : ""}
          </p>
        </div>
        <AddressForm
          value={shipTo}
          onChange={(next) => {
            setShipTo(next)
            clearQuotedRates()
          }}
          inputClassName="h-10"
          selectTriggerClassName="h-10"
          formId="replace-label-ship-to"
        />
        {shipToError ? <p className="text-xs text-destructive">{shipToError}</p> : null}
      </div>

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
          disabled={
            !overview.eligible ||
            ratesBusy ||
            purchaseBusy ||
            !parcelParse.ok ||
            Boolean(shipFromError || shipToError)
          }
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
          <p className="text-xs text-muted-foreground">
            Showing the lowest UPS Ground or Priority rates.
          </p>

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

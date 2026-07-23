"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { Loader2, Truck } from "lucide-react"
import { toast } from "sonner"
import { validateLabelParcelEntry } from "@/lib/shipping/surfboard-label-limits"
import { SellerShippingLabelCheckout } from "@/components/seller-shipping-label-checkout"

type SellerAddr = { id: string; label: string; oneLine: string; isDefault: boolean }

type RateRow = {
  rate_id: string
  carrierLabel: string
  serviceName: string
  amount: number
  currency: string
}

type OverviewResponse = {
  data: {
    eligible: boolean
    ineligibleReasons: string[]
    shipEngineConfigured: boolean
    walletSpendableUsd: number
    buyerPrepaidShippingUsd: number
    order: {
      id: string
      orderNum: string | null
      displayOrderNum: string
      listingTitle: string
      section: string
      fulfillmentMethod: string | null
      deliveryStatus: string
    }
    sellerAddresses: SellerAddr[]
    autoLabelParcel: { ok: false; error: string }
    suggestedParcelDims: { lengthIn: number; widthIn: number; heightIn: number } | null
  }
}

const EMPTY_MANUAL_PARCEL = {
  length_in: "",
  width_in: "",
  height_in: "",
  weight_lb: "",
}

function parseManualParcelFields(parcel: typeof EMPTY_MANUAL_PARCEL) {
  return {
    lengthIn: Number(parcel.length_in),
    widthIn: Number(parcel.width_in),
    heightIn: Number(parcel.height_in),
    weightLb: Number(parcel.weight_lb),
  }
}

function manualParcelValidation(parcel: typeof EMPTY_MANUAL_PARCEL) {
  return validateLabelParcelEntry(parseManualParcelFields(parcel))
}

function manualParcelFieldsValid(parcel: typeof EMPTY_MANUAL_PARCEL): boolean {
  return manualParcelValidation(parcel).ok
}

function manualParcelHasAnyValue(parcel: typeof EMPTY_MANUAL_PARCEL): boolean {
  return Boolean(
    parcel.length_in.trim() ||
      parcel.width_in.trim() ||
      parcel.height_in.trim() ||
      parcel.weight_lb.trim(),
  )
}

function ManualParcelFields({
  manualParcel,
  onChange,
  idPrefix = "",
}: {
  manualParcel: typeof EMPTY_MANUAL_PARCEL
  onChange: (next: typeof EMPTY_MANUAL_PARCEL) => void
  idPrefix?: string
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}L`}>Length (in)</Label>
        <Input
          id={`${idPrefix}L`}
          inputMode="decimal"
          placeholder="e.g. 10"
          value={manualParcel.length_in}
          onChange={(e) => onChange({ ...manualParcel, length_in: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}W`}>Width (in)</Label>
        <Input
          id={`${idPrefix}W`}
          inputMode="decimal"
          placeholder="e.g. 7"
          value={manualParcel.width_in}
          onChange={(e) => onChange({ ...manualParcel, width_in: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}H`}>Height (in)</Label>
        <Input
          id={`${idPrefix}H`}
          inputMode="decimal"
          placeholder="e.g. 4"
          value={manualParcel.height_in}
          onChange={(e) => onChange({ ...manualParcel, height_in: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}Wt`}>Weight (lb)</Label>
        <Input
          id={`${idPrefix}Wt`}
          inputMode="decimal"
          placeholder="e.g. 3"
          value={manualParcel.weight_lb}
          onChange={(e) => onChange({ ...manualParcel, weight_lb: e.target.value })}
        />
      </div>
    </div>
  )
}

export function ShippingLabelTool({ orderId }: { orderId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [overview, setOverview] = useState<OverviewResponse["data"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [ratesBusy, setRatesBusy] = useState(false)
  const [rates, setRates] = useState<RateRow[] | null>(null)
  const [selectedRateId, setSelectedRateId] = useState<string>("")

  const [sellerAddressId, setSellerAddressId] = useState<string>("")
  const [manualParcel, setManualParcel] = useState(EMPTY_MANUAL_PARCEL)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/shipping-label`, {
        credentials: "include",
      })
      const body = (await res.json()) as OverviewResponse | { error?: string }
      if (!res.ok || !("data" in body) || !body.data) {
        toast.error("error" in body && body.error ? body.error : "Could not load order")
        setOverview(null)
        return
      }
      setOverview(body.data)
      const addrs = body.data.sellerAddresses
      const preferred = addrs.find((a) => a.isDefault)?.id ?? addrs[0]?.id ?? ""
      setSellerAddressId(preferred)

      const suggested = body.data.suggestedParcelDims
      setManualParcel(
        suggested
          ? {
              length_in: String(suggested.lengthIn),
              width_in: String(suggested.widthIn),
              height_in: String(suggested.heightIn),
              weight_lb: "",
            }
          : EMPTY_MANUAL_PARCEL,
      )
      setRates(null)
      setSelectedRateId("")
    } catch {
      toast.error("Could not load order")
      setOverview(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  const canUseTool = useMemo(() => {
    if (!overview?.eligible) return false
    if (!overview.shipEngineConfigured) return false
    return overview.sellerAddresses.length > 0
  }, [overview])

  const requestRates = async () => {
    if (!sellerAddressId && overview && overview.sellerAddresses.length > 1) {
      toast.error("Choose your ship-from address")
      return
    }

    const parcelCheck = manualParcelValidation(manualParcel)
    if (!parcelCheck.ok) {
      toast.error(parcelCheck.error)
      return
    }

    setRatesBusy(true)
    setRates(null)
    setSelectedRateId("")
    try {
      const p = parseManualParcelFields(manualParcel)
      const payload: Record<string, unknown> = {
        action: "rates",
        parcel: {
          length_in: p.lengthIn,
          width_in: p.widthIn,
          height_in: p.heightIn,
          weight_lb: p.weightLb,
        },
      }
      if (sellerAddressId) {
        payload.seller_address_id = sellerAddressId
      }

      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/shipping-label`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as {
        data?: { rates: RateRow[] }
        error?: string
      }
      if (!res.ok || !data.data?.rates) {
        toast.error(data.error ?? "Could not get rates")
        return
      }
      setRates(data.data.rates)
      if (data.data.rates[0]?.rate_id) {
        setSelectedRateId(data.data.rates[0].rate_id)
      }
    } catch {
      toast.error("Could not get rates")
    } finally {
      setRatesBusy(false)
    }
  }

  const selectedRate = useMemo(
    () => rates?.find((r) => r.rate_id === selectedRateId) ?? null,
    [rates, selectedRateId],
  )

  const checkoutPayload = useMemo(() => {
    if (!selectedRate || !manualParcelFieldsValid(manualParcel)) return null
    const p = parseManualParcelFields(manualParcel)
    const payload: {
      rate_id: string
      seller_address_id?: string
      parcel: {
        length_in: number
        width_in: number
        height_in: number
        weight_lb: number
      }
    } = {
      rate_id: selectedRate.rate_id,
      parcel: {
        length_in: p.lengthIn,
        width_in: p.widthIn,
        height_in: p.heightIn,
        weight_lb: p.weightLb,
      },
    }
    if (sellerAddressId) {
      payload.seller_address_id = sellerAddressId
    }
    return payload
  }, [
    selectedRate,
    sellerAddressId,
    manualParcel.length_in,
    manualParcel.width_in,
    manualParcel.height_in,
    manualParcel.weight_lb,
  ])

  const handleLabelPurchaseSuccess = useCallback(
    (data: { labelUrl: string | null; trackingNumber: string; orderDisplayNum: string }) => {
      toast.success(
        `Label purchased for order #${data.orderDisplayNum} — tracking added to the order`,
      )
      if (data.labelUrl) {
        window.open(data.labelUrl, "_blank", "noopener,noreferrer")
      }
      // Back to the sale: the label PDF, tracking, and shipped status all live there.
      router.push(`/dashboard/sales/${encodeURIComponent(orderId)}`)
    },
    [router, orderId],
  )

  useEffect(() => {
    const paymentIntentId = searchParams.get("payment_intent")?.trim()
    const redirectStatus = searchParams.get("redirect_status")?.trim()
    if (!paymentIntentId || redirectStatus !== "succeeded") return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderId)}/shipping-label/finalize`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payment_intent_id: paymentIntentId }),
          },
        )
        const data = (await res.json()) as {
          data?: { labelUrl: string | null; trackingNumber: string; orderDisplayNum: string }
          error?: string
        }
        if (cancelled) return
        if (!res.ok || !data.data) {
          toast.error(data.error ?? "Could not complete label purchase after payment")
          return
        }
        handleLabelPurchaseSuccess(data.data)
      } catch {
        if (!cancelled) toast.error("Could not complete label purchase after payment")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [orderId, searchParams, router, handleLabelPurchaseSuccess])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading shipping tools…
        </CardContent>
      </Card>
    )
  }

  if (!overview) {
    return null
  }

  const manualParcelCheck = manualParcelValidation(manualParcel)
  const manualParcelReady = manualParcelCheck.ok
  const manualParcelHint =
    manualParcelHasAnyValue(manualParcel) && !manualParcelCheck.ok
      ? manualParcelCheck.error
      : null
  const singleAddr = overview.sellerAddresses.length === 1
  const preferredAddr = overview.sellerAddresses.find((a) => a.id === sellerAddressId)

  return (
    <Card className="border-primary/25">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Print shipping label
        </CardTitle>
        <CardDescription>
          Order #{overview.order.displayOrderNum} · {overview.order.listingTitle}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!overview.eligible && (
          <Alert>
            <AlertTitle>Not available for this order</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4 space-y-1">
                {overview.ineligibleReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {overview.eligible && !overview.shipEngineConfigured && (
          <Alert>
            <AlertTitle>Printing unavailable</AlertTitle>
            <AlertDescription>
              Label purchasing is not set up right now. You can still add
              tracking manually from{" "}
              <Link href={`/dashboard/sales/${orderId}`} className="underline font-medium">
                this sale
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}

        {overview.eligible && overview.shipEngineConfigured && overview.sellerAddresses.length === 0 && (
          <Alert>
            <AlertTitle>Add a ship-from address</AlertTitle>
            <AlertDescription>
              Save an address on your profile so we know where the board ships from, then return
              here.{" "}
              <Link href="/profile" className="underline font-medium">
                Profile → addresses
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {canUseTool && (
          <>
            <Alert>
              <AlertTitle>Enter packed dimensions for a real quote</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Measure the carton you will ship — length, width, height, and weight on a scale.
                  We quote live carrier rates from those measurements (fins, boards, or anything
                  else). Any flat shipping the buyer prepaid is credited toward the label; you only
                  pay the difference if the label costs more.
                </p>
                {singleAddr && preferredAddr ? (
                  <p className="text-sm">
                    Ship from:{" "}
                    <span className="font-medium text-foreground">
                      {preferredAddr.label} — {preferredAddr.oneLine}
                    </span>
                  </p>
                ) : null}
              </AlertDescription>
            </Alert>

            {!singleAddr && (
              <div className="space-y-2">
                <Label htmlFor="ship-from">Ship from (your address)</Label>
                <Select
                  value={sellerAddressId}
                  onValueChange={(id) => {
                    setSellerAddressId(id)
                    setRates(null)
                    setSelectedRateId("")
                  }}
                >
                  <SelectTrigger id="ship-from">
                    <SelectValue placeholder="Select address" />
                  </SelectTrigger>
                  <SelectContent>
                    {overview.sellerAddresses.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label} — {a.oneLine}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Packed box dimensions</p>
              <p className="text-sm text-muted-foreground">
                Enter the carton you will ship — any size that fits UPS limits. Length is the
                longest side. UPS limit: Length + (2 × Width) + (2 × Height) must be 160″ or less;
                weight 25 lb or less.
                {overview.suggestedParcelDims
                  ? " Length, width, and height are prefilled from the listing — confirm with a tape measure and enter the packed weight."
                  : null}
              </p>
              <ManualParcelFields
                idPrefix="required-"
                manualParcel={manualParcel}
                onChange={(next) => {
                  setManualParcel(next)
                  setRates(null)
                  setSelectedRateId("")
                }}
              />
              {manualParcelHint ? (
                <p className="text-sm text-destructive" role="alert">
                  {manualParcelHint}
                </p>
              ) : null}
              <Button
                type="button"
                variant="default"
                disabled={ratesBusy || !manualParcelReady}
                onClick={() => void requestRates()}
              >
                {ratesBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Get carrier rates
              </Button>
            </div>

            {ratesBusy && !rates && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching rates from carriers…
              </p>
            )}

            {rates && rates.length > 0 && (
              <div className="space-y-3">
                <Label>Select rate</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Carrier</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rates.map((r) => (
                        <TableRow key={r.rate_id}>
                          <TableCell>{r.carrierLabel}</TableCell>
                          <TableCell>{r.serviceName}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.currency} ${r.amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <input
                              type="radio"
                              name="rate"
                              checked={selectedRateId === r.rate_id}
                              onChange={() => setSelectedRateId(r.rate_id)}
                              aria-label={`Select ${r.carrierLabel} ${r.serviceName}`}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <SellerShippingLabelCheckout
                  orderId={orderId}
                  checkoutPayload={checkoutPayload}
                  amountUsd={selectedRate?.amount ?? 0}
                  buyerPrepaidShippingUsd={overview.buyerPrepaidShippingUsd}
                  walletSpendableUsd={overview.walletSpendableUsd}
                  onSuccess={handleLabelPurchaseSuccess}
                />
                <p className="text-xs text-muted-foreground">
                  Rates use the dimensions you entered above. Buyer prepaid flat shipping on this
                  order is credited toward the label first; you pay any remainder by card.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

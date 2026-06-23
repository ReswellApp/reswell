"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { ChevronDown, Download, ExternalLink, Loader2, Printer, Search, Truck, Wallet, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { computeSellerLabelPrepaidAllowanceBreakdown } from "@/lib/shipping/seller-label-payment-breakdown"
import { isSurfboardLabelParcelLimitError, validateSurfboardLabelParcelLimits } from "@/lib/shipping/surfboard-label-limits"

type AutoLabelParcelOk = {
  ok: true
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
  source: string
}

type AutoLabelParcelErr = { ok: false; error: string }

type SellerAddr = { id: string; label: string; oneLine: string; isDefault: boolean }

type RateRow = {
  rate_id: string
  carrierLabel: string
  serviceName: string
  amount: number
  currency: string
}

type AdminOrderOverview = {
  eligible: boolean
  ineligibleReasons: string[]
  shipEngineConfigured: boolean
  order: {
    id: string
    orderNum: string | null
    displayOrderNum: string
    listingTitle: string
    section: string
    fulfillmentMethod: string | null
    deliveryStatus: string
    sellerId: string
  }
  checkoutLane: {
    buyerPaidShippingUsd: number
    boardShippingMode: "free" | "flat" | "reswell"
    quoteMethod: string
  }
  sellerWalletLane: {
    eligible: boolean
    ineligibleReasons: string[]
    buyerPrepaidShippingUsd: number
    walletSpendableUsd: number
    sellerAddresses: SellerAddr[]
  }
  autoLabelParcel: AutoLabelParcelOk | AutoLabelParcelErr
}

type OverviewResponse = { data: AdminOrderOverview }

type OrderSearchRow = {
  id: string
  order_num: string | null
  amount: number | string
  fulfillment_method: string | null
  created_at: string
}

const ORDER_UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

const FALLBACK_MANUAL_PARCEL = {
  length_in: "72",
  width_in: "20",
  height_in: "6",
  weight_lb: "12",
}

const EMPTY_MANUAL_PARCEL = {
  length_in: "",
  width_in: "",
  height_in: "",
  weight_lb: "",
}

function extractOrderIdFromPaste(raw: string): string | null {
  const t = raw.trim()
  const m = t.match(ORDER_UUID_RE)
  return m ? m[0].toLowerCase() : null
}

function boardModeLabel(mode: AdminOrderOverview["checkoutLane"]["boardShippingMode"]): string {
  if (mode === "reswell") return "Reswell-calculated (checkout uses cheapest carrier)"
  if (mode === "flat") return "Flat shipping (seller pays for label)"
  return "Free shipping (seller pays for label)"
}

function parseManualParcelFields(parcel: typeof EMPTY_MANUAL_PARCEL) {
  return {
    lengthIn: Number(parcel.length_in),
    widthIn: Number(parcel.width_in),
    heightIn: Number(parcel.height_in),
    weightLb: Number(parcel.weight_lb),
  }
}

function manualParcelFieldsValid(parcel: typeof EMPTY_MANUAL_PARCEL): boolean {
  const { lengthIn, widthIn, heightIn, weightLb } = parseManualParcelFields(parcel)
  if (!Number.isFinite(lengthIn) || lengthIn < 6 || lengthIn > 77) return false
  if (!Number.isFinite(widthIn) || widthIn < 4 || widthIn > 48) return false
  if (!Number.isFinite(heightIn) || heightIn < 2 || heightIn > 36) return false
  if (!Number.isFinite(weightLb) || weightLb < 1 || weightLb > 25) return false
  return validateSurfboardLabelParcelLimits({ lengthIn, weightLb }).ok
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
          placeholder="e.g. 72"
          value={manualParcel.length_in}
          onChange={(e) => onChange({ ...manualParcel, length_in: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}W`}>Width (in)</Label>
        <Input
          id={`${idPrefix}W`}
          inputMode="decimal"
          placeholder="e.g. 20"
          value={manualParcel.width_in}
          onChange={(e) => onChange({ ...manualParcel, width_in: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}H`}>Height (in)</Label>
        <Input
          id={`${idPrefix}H`}
          inputMode="decimal"
          placeholder="e.g. 6"
          value={manualParcel.height_in}
          onChange={(e) => onChange({ ...manualParcel, height_in: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}Wt`}>Weight (lb)</Label>
        <Input
          id={`${idPrefix}Wt`}
          inputMode="decimal"
          placeholder="e.g. 12"
          value={manualParcel.weight_lb}
          onChange={(e) => onChange({ ...manualParcel, weight_lb: e.target.value })}
        />
      </div>
    </div>
  )
}

export function AdminOrderLabelPurchase() {
  const [searchQ, setSearchQ] = useState("")
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchHits, setSearchHits] = useState<OrderSearchRow[]>([])
  const [orderId, setOrderId] = useState<string | null>(null)

  const [overview, setOverview] = useState<AdminOrderOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [purchaseBusy, setPurchaseBusy] = useState(false)
  const [labelReadyOpen, setLabelReadyOpen] = useState(false)
  const [labelReady, setLabelReady] = useState<{
    labelUrl: string | null
    trackingNumber: string
    orderDisplayNum: string
  } | null>(null)

  const [sellerAddressId, setSellerAddressId] = useState("")
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [manualParcel, setManualParcel] = useState(FALLBACK_MANUAL_PARCEL)
  const [ratesBusy, setRatesBusy] = useState(false)
  const [rates, setRates] = useState<RateRow[] | null>(null)
  const [selectedRateId, setSelectedRateId] = useState("")
  const [walletBusy, setWalletBusy] = useState(false)

  const loadOrder = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/shipping/order-label?order_id=${encodeURIComponent(id)}`, {
        credentials: "include",
      })
      const body = (await res.json()) as OverviewResponse | { error?: string }
      if (!res.ok || !("data" in body) || !body.data) {
        toast.error("error" in body && body.error ? body.error : "Could not load order")
        setOverview(null)
        return
      }
      setOverview(body.data)

      const addrs = body.data.sellerWalletLane.sellerAddresses
      const preferred = addrs.find((a) => a.isDefault)?.id ?? addrs[0]?.id ?? ""
      setSellerAddressId(preferred)

      if (body.data.autoLabelParcel.ok) {
        const p = body.data.autoLabelParcel
        setManualParcel({
          length_in: String(p.lengthIn),
          width_in: String(p.widthIn),
          height_in: String(p.heightIn),
          weight_lb: String(p.weightLb),
        })
        setAdjustOpen(false)
      } else if (isSurfboardLabelParcelLimitError(body.data.autoLabelParcel.error)) {
        setManualParcel(FALLBACK_MANUAL_PARCEL)
        setAdjustOpen(true)
      } else {
        setManualParcel(EMPTY_MANUAL_PARCEL)
        setAdjustOpen(true)
      }

      setRates(null)
      setSelectedRateId("")
    } catch {
      toast.error("Could not load order")
      setOverview(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!orderId) {
      setOverview(null)
      return
    }
    void loadOrder(orderId)
  }, [orderId, loadOrder])

  useEffect(() => {
    const q = searchQ.trim()
    if (q.length < 2) {
      setSearchHits([])
      return
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setSearchBusy(true)
        try {
          const res = await fetch(
            `/api/admin/orders?q=${encodeURIComponent(q)}&limit=15&status=all`,
            { credentials: "include" },
          )
          const body = (await res.json()) as { data?: OrderSearchRow[]; error?: string }
          if (!res.ok) {
            setSearchHits([])
            return
          }
          const rows = (body.data ?? []).filter((r) => r.fulfillment_method === "shipping")
          setSearchHits(rows)
        } catch {
          setSearchHits([])
        } finally {
          setSearchBusy(false)
        }
      })()
    }, 320)
    return () => window.clearTimeout(t)
  }, [searchQ])

  const applyPastedOrderId = (raw: string) => {
    const id = extractOrderIdFromPaste(raw)
    if (!id) {
      toast.error("Could not find an order ID in that text.")
      return
    }
    setOrderId(id)
    setSearchHits([])
    setSearchQ(id.slice(0, 8) + "…")
  }

  const showLabelReady = (data: {
    labelUrl: string | null
    trackingNumber: string
    orderDisplayNum: string
  }) => {
    setLabelReady(data)
    setLabelReadyOpen(true)
  }

  const buyCheckoutLane = async () => {
    if (!orderId) return
    setPurchaseBusy(true)
    try {
      const res = await fetch("/api/admin/shipping/order-label", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, action: "purchase_checkout_lane" }),
      })
      const data = (await res.json()) as {
        data?: {
          labelUrl: string | null
          trackingNumber: string
          orderDisplayNum: string
          liveQuoteUsd: number
          carrierLabel: string
          serviceName: string
          quoteVsPaidNote?: string
        }
        error?: string
      }
      if (!res.ok || !data.data) {
        const msg = data.error?.trim() || "Could not buy label"
        toast.error(msg.length > 600 ? `${msg.slice(0, 600)}…` : msg, { duration: 12_000 })
        return
      }
      if (data.data.quoteVsPaidNote) {
        toast.message("Checkout vs live rate", {
          description: data.data.quoteVsPaidNote,
          duration: 10_000,
        })
      }
      showLabelReady({
        labelUrl: data.data.labelUrl ?? null,
        trackingNumber: data.data.trackingNumber,
        orderDisplayNum: data.data.orderDisplayNum,
      })
      toast.success(
        `Label purchased for #${data.data.orderDisplayNum} — ${data.data.carrierLabel} ${data.data.serviceName} ($${data.data.liveQuoteUsd.toFixed(2)}).`,
      )
      void loadOrder(orderId)
    } catch {
      toast.error("Could not buy label")
    } finally {
      setPurchaseBusy(false)
    }
  }

  const requestRates = async (opts?: { useManualParcel?: boolean }) => {
    if (!orderId || !overview) return

    const useManual =
      opts?.useManualParcel === true ||
      !overview.autoLabelParcel.ok ||
      adjustOpen

    if (useManual && !manualParcelFieldsValid(manualParcel)) {
      toast.error("Enter valid packed length, width, height, and weight to get carrier rates.")
      return
    }

    setRatesBusy(true)
    setRates(null)
    setSelectedRateId("")
    try {
      const payload: Record<string, unknown> = {
        order_id: orderId,
        action: "rates",
      }
      if (sellerAddressId) {
        payload.seller_address_id = sellerAddressId
      }
      if (useManual) {
        const p = parseManualParcelFields(manualParcel)
        payload.parcel = {
          length_in: p.lengthIn,
          width_in: p.widthIn,
          height_in: p.heightIn,
          weight_lb: p.weightLb,
        }
      }

      const res = await fetch("/api/admin/shipping/order-label", {
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

  const purchaseWithSellerWallet = async () => {
    if (!orderId || !selectedRateId || !overview) return

    const useManual = adjustOpen || !overview.autoLabelParcel.ok
    if (useManual && !manualParcelFieldsValid(manualParcel)) {
      toast.error("Enter valid packed dimensions before purchasing.")
      return
    }

    setWalletBusy(true)
    try {
      const payload: Record<string, unknown> = {
        order_id: orderId,
        action: "purchase_seller_wallet",
        rate_id: selectedRateId,
      }
      if (sellerAddressId) {
        payload.seller_address_id = sellerAddressId
      }
      if (useManual) {
        const p = parseManualParcelFields(manualParcel)
        payload.parcel = {
          length_in: p.lengthIn,
          width_in: p.widthIn,
          height_in: p.heightIn,
          weight_lb: p.weightLb,
        }
      }

      const res = await fetch("/api/admin/shipping/order-label", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as {
        data?: {
          labelUrl: string | null
          trackingNumber: string
          orderDisplayNum: string
          amountUsd: number
          buyerPrepaidAppliedUsd: number
          shippingSurplusCreditUsd: number
          walletBalanceAfter: number
        }
        error?: string
      }
      if (!res.ok || !data.data) {
        toast.error(data.error ?? "Could not purchase label with buyer shipping credit")
        return
      }

      showLabelReady({
        labelUrl: data.data.labelUrl ?? null,
        trackingNumber: data.data.trackingNumber,
        orderDisplayNum: data.data.orderDisplayNum,
      })
      toast.success(
        `Label purchased for #${data.data.orderDisplayNum} — $${data.data.buyerPrepaidAppliedUsd.toFixed(2)} from buyer shipping${
          data.data.shippingSurplusCreditUsd > 0
            ? `, $${data.data.shippingSurplusCreditUsd.toFixed(2)} credited to seller wallet`
            : ""
        }.`,
      )
      void loadOrder(orderId)
    } catch {
      toast.error("Could not purchase label with buyer shipping credit")
    } finally {
      setWalletBusy(false)
    }
  }

  const clearOrder = () => {
    setOrderId(null)
    setOverview(null)
    setSearchQ("")
    setSearchHits([])
    setRates(null)
    setSelectedRateId("")
  }

  const openLabelPdf = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const downloadLabelPdf = async (url: string, orderDisplayNum: string) => {
    const safeName = `reswell-label-${orderDisplayNum.replace(/[^a-zA-Z0-9-_]/g, "-")}.pdf`
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error("fetch failed")
      const blob = await res.blob()
      const obj = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = obj
      a.download = safeName
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(obj)
    } catch {
      toast.message("Download blocked — opening PDF in a new tab", {
        description: "Use Save or Print to PDF from the opened tab.",
      })
      openLabelPdf(url)
    }
  }

  const selectedRate = useMemo(
    () => rates?.find((r) => r.rate_id === selectedRateId) ?? null,
    [rates, selectedRateId],
  )

  const autoOk = overview?.autoLabelParcel.ok ?? false
  const parcelLimitError =
    overview != null &&
    !overview.autoLabelParcel.ok &&
    isSurfboardLabelParcelLimitError(overview.autoLabelParcel.error)
  const needsManualParcel = overview != null && !autoOk && !parcelLimitError
  const manualParcelReady = manualParcelFieldsValid(manualParcel)
  const canUseBuyerShippingCreditLane =
    overview?.sellerWalletLane.eligible === true &&
    overview.shipEngineConfigured &&
    overview.sellerWalletLane.sellerAddresses.length > 0
  const buyerShippingCreditUsd = overview?.sellerWalletLane.buyerPrepaidShippingUsd ?? 0
  const sellerWalletUsd = overview?.sellerWalletLane.walletSpendableUsd ?? 0
  const labelPaymentBreakdown = useMemo(() => {
    if (!selectedRate || !overview) return null
    return computeSellerLabelPrepaidAllowanceBreakdown({
      labelCostUsd: selectedRate.amount,
      buyerPrepaidAvailableUsd: buyerShippingCreditUsd,
    })
  }, [selectedRate, overview, buyerShippingCreditUsd])
  const canPayWithBuyerShippingCredit = labelPaymentBreakdown?.canPurchaseWithPrepaidAllowance === true
  const showCheckoutLane =
    overview?.checkoutLane.boardShippingMode === "reswell" ||
    (overview?.eligible && overview.shipEngineConfigured && autoOk)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="admin-order-lookup" className="text-sm font-medium text-foreground">
            Order
          </Label>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Paste an order URL from <span className="text-foreground/90">/admin/orders/…</span>, paste the order
            UUID, or search by order number. Only <span className="text-foreground/90">shipping</span> orders are
            listed.
          </p>
          {orderId ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
              <div className="min-w-0">
                {overview ? (
                  <>
                    <p className="text-sm font-medium truncate">
                      #{overview.order.displayOrderNum} · {overview.order.listingTitle}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{orderId}</p>
                  </>
                ) : loading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono truncate">{orderId}</p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 rounded-xl"
                onClick={() => clearOrder()}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          ) : (
            <>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-order-lookup"
                  className="h-11 rounded-xl pl-9"
                  placeholder="Search order #, or paste URL / UUID…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return
                    const id = extractOrderIdFromPaste(searchQ)
                    if (id) {
                      e.preventDefault()
                      applyPastedOrderId(searchQ)
                    }
                  }}
                />
              </div>
              {searchBusy ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching…
                </p>
              ) : null}
            </>
          )}
          {!orderId && searchHits.length > 0 ? (
            <div
              className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-background shadow-sm"
              role="listbox"
            >
              {searchHits.map((row) => {
                const amt = typeof row.amount === "number" ? row.amount : Number(row.amount)
                return (
                  <button
                    key={row.id}
                    type="button"
                    role="option"
                    className="flex w-full items-center justify-between gap-3 border-b border-border/40 px-4 py-3 text-left text-sm last:border-0 hover:bg-muted/50"
                    onClick={() => {
                      setOrderId(row.id)
                      setSearchQ(row.order_num?.trim() || row.id.slice(0, 8) + "…")
                      setSearchHits([])
                    }}
                  >
                    <span className="font-medium">
                      {row.order_num?.trim() ? `#${row.order_num.trim()}` : row.id.slice(0, 8) + "…"}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {Number.isFinite(amt) ? `$${amt.toFixed(2)}` : "—"} · ships
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>

      {!orderId ? (
        <p className="text-sm text-muted-foreground px-1">
          Choose a shipping order to buy a label on the checkout lane (Reswell account) or debit the seller&apos;s
          wallet up to the buyer&apos;s prepaid flat shipping (flat/free shipping orders).
        </p>
      ) : loading ? (
        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading order…
          </CardContent>
        </Card>
      ) : !overview ? null : (
        <>
          {showCheckoutLane ? (
            <Card className="rounded-2xl border-border bg-card">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                      <Truck className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="space-y-1">
                      <CardTitle className="text-lg">Buy label (checkout lane)</CardTitle>
                      <CardDescription>
                        #{overview.order.displayOrderNum} · {overview.order.listingTitle}
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 rounded-xl" asChild>
                    <Link href={`/admin/orders/${overview.order.id}`}>Admin order</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!overview.eligible && (
                  <Alert className="rounded-xl">
                    <AlertTitle>Not available</AlertTitle>
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
                  <Alert className="rounded-xl">
                    <AlertTitle>ShipEngine not configured</AlertTitle>
                    <AlertDescription>
                      Set <code className="text-xs">SHIPENGINE_API_KEY</code> on the server.
                    </AlertDescription>
                  </Alert>
                )}

                {overview.eligible && overview.shipEngineConfigured && (
                  <>
                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm space-y-2">
                      <p>
                        <span className="text-muted-foreground">Buyer paid shipping:</span>{" "}
                        <span className="font-medium tabular-nums text-foreground">
                          ${overview.checkoutLane.buyerPaidShippingUsd.toFixed(2)}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Listing shipping mode:</span>{" "}
                        <span className="text-foreground">{boardModeLabel(overview.checkoutLane.boardShippingMode)}</span>
                      </p>
                      {overview.autoLabelParcel.ok ? (
                        <p>
                          <span className="text-muted-foreground">Package (listing / checkout):</span>{" "}
                          <span className="tabular-nums text-foreground">
                            {overview.autoLabelParcel.lengthIn} × {overview.autoLabelParcel.widthIn} ×{" "}
                            {overview.autoLabelParcel.heightIn} in · {overview.autoLabelParcel.weightLb} lb
                          </span>
                          <span className="text-muted-foreground"> ({overview.autoLabelParcel.source})</span>
                        </p>
                      ) : (
                        <p className="text-destructive text-sm">{overview.autoLabelParcel.error}</p>
                      )}
                      <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                        {overview.checkoutLane.quoteMethod}
                      </p>
                    </div>

                    <Button
                      type="button"
                      className="h-11 px-6"
                      onClick={() => void buyCheckoutLane()}
                      disabled={purchaseBusy || !overview.autoLabelParcel.ok}
                    >
                      {purchaseBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Printer className="h-4 w-4 mr-2" />
                      )}
                      Buy label
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Uses the cheapest ShipEngine rate for the same listing origin, packed size, and buyer address as
                      peer checkout. Carrier bills your ShipEngine account. This does not mark the order as shipped —
                      the seller attaches the label and ships when ready. Tracking is saved on the order for the buyer.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {overview.checkoutLane.boardShippingMode !== "reswell" ? (
            <Card className="rounded-2xl border-border bg-card">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Wallet className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="space-y-1">
                      <CardTitle className="text-lg">Buy label (flat shipping allowance)</CardTitle>
                      <CardDescription>
                        Pay for the label from buyer prepaid flat shipping. Unused shipping is credited to the
                        seller&apos;s wallet.
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 rounded-xl" asChild>
                    <Link href={`/admin/orders/${overview.order.id}`}>Admin order</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!canUseBuyerShippingCreditLane && (
                  <Alert className="rounded-xl">
                    <AlertTitle>Not available</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 space-y-1">
                        {overview.sellerWalletLane.ineligibleReasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {canUseBuyerShippingCreditLane && (
                  <>
                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm space-y-2">
                      <p>
                        <span className="text-muted-foreground">Buyer prepaid flat shipping:</span>{" "}
                        <span className="font-medium tabular-nums text-foreground">
                          ${buyerShippingCreditUsd.toFixed(2)}
                        </span>
                      </p>
                      {labelPaymentBreakdown && labelPaymentBreakdown.shippingSurplusCreditUsd > 0 ? (
                        <p>
                          <span className="text-muted-foreground">Seller wallet credit after purchase:</span>{" "}
                          <span className="font-medium tabular-nums text-foreground">
                            +${labelPaymentBreakdown.shippingSurplusCreditUsd.toFixed(2)}
                          </span>
                        </p>
                      ) : null}
                      <p>
                        <span className="text-muted-foreground">Seller wallet balance now:</span>{" "}
                        <span className="font-medium tabular-nums text-foreground">
                          ${sellerWalletUsd.toFixed(2)}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Listing shipping mode:</span>{" "}
                        <span className="text-foreground">{boardModeLabel(overview.checkoutLane.boardShippingMode)}</span>
                      </p>
                      {overview.autoLabelParcel.ok ? (
                        <p>
                          <span className="text-muted-foreground">Package (from listing):</span>{" "}
                          <span className="tabular-nums text-foreground">
                            {overview.autoLabelParcel.lengthIn} × {overview.autoLabelParcel.widthIn} ×{" "}
                            {overview.autoLabelParcel.heightIn} in · {overview.autoLabelParcel.weightLb} lb
                          </span>
                        </p>
                      ) : needsManualParcel ? (
                        <p className="text-muted-foreground">
                          Listing has no saved dimensions — enter packed box size below to get rates.
                        </p>
                      ) : (
                        <p className="text-destructive">{overview.autoLabelParcel.error}</p>
                      )}
                    </div>

                    {overview.sellerWalletLane.sellerAddresses.length > 1 ? (
                      <div className="space-y-2">
                        <Label htmlFor="admin-ship-from">Seller ship-from address</Label>
                        <Select
                          value={sellerAddressId}
                          onValueChange={(id) => {
                            setSellerAddressId(id)
                            setRates(null)
                            setSelectedRateId("")
                          }}
                        >
                          <SelectTrigger id="admin-ship-from" className="rounded-xl">
                            <SelectValue placeholder="Select address" />
                          </SelectTrigger>
                          <SelectContent>
                            {overview.sellerWalletLane.sellerAddresses.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.label} — {a.oneLine}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {needsManualParcel ? (
                      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                        <p className="text-sm font-medium text-foreground">Packed box dimensions</p>
                        <p className="text-sm text-muted-foreground">
                          Measure the carton the seller will ship in. Max 77″ length and 25 lb for Reswell labels.
                        </p>
                        <ManualParcelFields
                          idPrefix="admin-required-"
                          manualParcel={manualParcel}
                          onChange={(next) => {
                            setManualParcel(next)
                            setRates(null)
                            setSelectedRateId("")
                          }}
                        />
                        <Button
                          type="button"
                          disabled={ratesBusy || !manualParcelReady}
                          onClick={() => void requestRates({ useManualParcel: true })}
                        >
                          {ratesBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Get carrier rates
                        </Button>
                      </div>
                    ) : null}

                    {autoOk ? (
                      <Collapsible open={adjustOpen} onOpenChange={setAdjustOpen}>
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1 px-0 text-muted-foreground"
                          >
                            <ChevronDown
                              className={cn("h-4 w-4 transition-transform", adjustOpen && "rotate-180")}
                            />
                            Different box or weight? Adjust and recalculate
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 pt-3">
                          <ManualParcelFields
                            idPrefix="admin-adjust-"
                            manualParcel={manualParcel}
                            onChange={(next) => {
                              setManualParcel(next)
                              setRates(null)
                              setSelectedRateId("")
                            }}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={ratesBusy || (adjustOpen && !manualParcelReady)}
                            onClick={() => void requestRates({ useManualParcel: true })}
                          >
                            {ratesBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Recalculate rates
                          </Button>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : null}

                    {autoOk && !needsManualParcel && !rates && !ratesBusy ? (
                      <Button type="button" disabled={ratesBusy} onClick={() => void requestRates()}>
                        {ratesBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Get carrier rates
                      </Button>
                    ) : null}

                    {ratesBusy && !rates ? (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Fetching rates from carriers…
                      </p>
                    ) : null}

                    {rates && rates.length > 0 ? (
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
                                      name="admin-rate"
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

                        <Button
                          type="button"
                          className="h-11 px-6"
                          disabled={walletBusy || !selectedRateId || !canPayWithBuyerShippingCredit}
                          onClick={() => void purchaseWithSellerWallet()}
                        >
                          {walletBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Wallet className="h-4 w-4 mr-2" />
                          )}
                          {labelPaymentBreakdown
                            ? `Buy label — $${labelPaymentBreakdown.buyerPrepaidAppliedUsd.toFixed(2)} from buyer shipping`
                            : "Buy label"}
                        </Button>

                        {selectedRate && labelPaymentBreakdown && !canPayWithBuyerShippingCredit ? (
                          <p className="text-sm text-destructive">
                            {labelPaymentBreakdown.excessOverPrepaidUsd > 0
                              ? `This label is $${selectedRate.amount.toFixed(2)}, but only $${buyerShippingCreditUsd.toFixed(2)} was prepaid for flat shipping. Choose a cheaper rate.`
                              : "This order has no buyer prepaid flat shipping for a label purchase."}
                          </p>
                        ) : null}

                        <p className="text-xs text-muted-foreground">
                          Uses the buyer&apos;s prepaid flat shipping to pay for the carrier label. Any unused
                          amount is credited to the seller&apos;s pending balance and released with the order
                          payout after delivery. No seller wallet debit is required when the label cost is
                          within the prepaid amount.
                        </p>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      <Dialog
        open={labelReadyOpen}
        onOpenChange={(open) => {
          setLabelReadyOpen(open)
          if (!open) setLabelReady(null)
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Label ready</DialogTitle>
            <DialogDescription>
              {labelReady ? (
                <>
                  Order #{labelReady.orderDisplayNum}. Tracking{" "}
                  <span className="font-mono text-foreground">{labelReady.trackingNumber}</span> is on the order
                  for the buyer. The seller can open the PDF from their sale.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {labelReady?.labelUrl ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-stretch">
              <Button
                type="button"
                className="flex-1 gap-2 rounded-xl"
                onClick={() => openLabelPdf(labelReady.labelUrl as string)}
              >
                <ExternalLink className="h-4 w-4" />
                Open PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 gap-2 rounded-xl"
                onClick={() => void downloadLabelPdf(labelReady.labelUrl as string, labelReady.orderDisplayNum)}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          ) : labelReady ? (
            <p className="text-sm text-muted-foreground">
              No direct PDF URL was returned. Tracking is still saved; check ShipEngine or the Labels created tab
              for storage details.
            </p>
          ) : null}
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl"
              onClick={() => {
                setLabelReadyOpen(false)
                setLabelReady(null)
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

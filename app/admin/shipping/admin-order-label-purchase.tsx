"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Download, ExternalLink, Loader2, Printer, Search, Truck, X } from "lucide-react"
import { toast } from "sonner"

type AutoLabelParcelOk = {
  ok: true
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
  source: string
}

type AutoLabelParcelErr = { ok: false; error: string }

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

/** Order id from paste: raw UUID, or URL/path containing a UUID (e.g. admin order page). */
function extractOrderIdFromPaste(raw: string): string | null {
  const t = raw.trim()
  const m = t.match(ORDER_UUID_RE)
  return m ? m[0].toLowerCase() : null
}

function boardModeLabel(mode: AdminOrderOverview["checkoutLane"]["boardShippingMode"]): string {
  if (mode === "reswell") return "Reswell-calculated (checkout uses cheapest carrier)"
  if (mode === "flat") return "Flat shipping (label still uses live carrier quote on checkout lane)"
  return "Free shipping (label uses live carrier quote on checkout lane)"
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
      setLabelReady({
        labelUrl: data.data.labelUrl ?? null,
        trackingNumber: data.data.trackingNumber,
        orderDisplayNum: data.data.orderDisplayNum,
      })
      setLabelReadyOpen(true)
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

  const clearOrder = () => {
    setOrderId(null)
    setOverview(null)
    setSearchQ("")
    setSearchHits([])
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
          Choose a shipping order to buy a label using checkout dimensions and the cheapest carrier on that lane.
        </p>
      ) : loading ? (
        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading order…
          </CardContent>
        </Card>
      ) : !overview ? null : (
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

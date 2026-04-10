"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { Loader2, Printer, Truck } from "lucide-react"
import { toast } from "sonner"

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
  }
}

const DEFAULT_PARCEL = {
  length_in: "72",
  width_in: "20",
  height_in: "6",
  weight_lb: "12",
}

export function ShippingLabelTool({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [overview, setOverview] = useState<OverviewResponse["data"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [ratesBusy, setRatesBusy] = useState(false)
  const [purchaseBusy, setPurchaseBusy] = useState(false)
  const [rates, setRates] = useState<RateRow[] | null>(null)
  const [selectedRateId, setSelectedRateId] = useState<string>("")

  const [sellerAddressId, setSellerAddressId] = useState<string>("")
  const [parcel, setParcel] = useState(DEFAULT_PARCEL)

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

  const getRates = async () => {
    if (!sellerAddressId) {
      toast.error("Choose your ship-from address")
      return
    }
    setRatesBusy(true)
    setRates(null)
    setSelectedRateId("")
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/shipping-label`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rates",
          seller_address_id: sellerAddressId,
          parcel: {
            length_in: Number(parcel.length_in),
            width_in: Number(parcel.width_in),
            height_in: Number(parcel.height_in),
            weight_lb: Number(parcel.weight_lb),
          },
        }),
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

  const buyLabel = async () => {
    if (!selectedRateId) {
      toast.error("Select a rate")
      return
    }
    setPurchaseBusy(true)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/shipping-label`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purchase",
          rate_id: selectedRateId,
        }),
      })
      const data = (await res.json()) as {
        data?: { labelUrl: string | null; trackingNumber: string; orderDisplayNum: string }
        error?: string
      }
      if (!res.ok || !data.data) {
        const msg = data.error?.trim() || "Could not buy label"
        toast.error("Could not buy label", {
          description:
            msg.length > 500 ? `${msg.slice(0, 500)}…` : msg,
          duration: 14_000,
        })
        return
      }
      toast.success(`Label created — Order #${data.data.orderDisplayNum}`)
      if (data.data.labelUrl) {
        window.open(data.data.labelUrl, "_blank", "noopener,noreferrer")
      }
      router.refresh()
      void load()
      setRates(null)
    } catch {
      toast.error("Could not buy label")
    } finally {
      setPurchaseBusy(false)
    }
  }

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
              Integrated labels require ShipEngine (`SHIPENGINE_API_KEY`) on the server. You can still add
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
            <div className="space-y-2">
              <Label htmlFor="ship-from">Ship from (your address)</Label>
              <Select value={sellerAddressId} onValueChange={setSellerAddressId}>
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="L">Length (in)</Label>
                <Input
                  id="L"
                  inputMode="decimal"
                  value={parcel.length_in}
                  onChange={(e) => setParcel((p) => ({ ...p, length_in: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="W">Width (in)</Label>
                <Input
                  id="W"
                  inputMode="decimal"
                  value={parcel.width_in}
                  onChange={(e) => setParcel((p) => ({ ...p, width_in: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="H">Height (in)</Label>
                <Input
                  id="H"
                  inputMode="decimal"
                  value={parcel.height_in}
                  onChange={(e) => setParcel((p) => ({ ...p, height_in: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="Wt">Weight (lb)</Label>
                <Input
                  id="Wt"
                  inputMode="decimal"
                  value={parcel.weight_lb}
                  onChange={(e) => setParcel((p) => ({ ...p, weight_lb: e.target.value }))}
                />
              </div>
            </div>

            <Button type="button" variant="secondary" onClick={() => void getRates()} disabled={ratesBusy}>
              {ratesBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Get carrier rates
            </Button>

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

                <Button type="button" onClick={() => void buyLabel()} disabled={purchaseBusy}>
                  {purchaseBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Printer className="h-4 w-4 mr-2" />
                  )}
                  Buy label &amp; add tracking
                </Button>
                <p className="text-xs text-muted-foreground">
                  Carrier charges your ShipEngine-connected accounts. We add tracking to the order and notify the
                  buyer—same as entering tracking manually on the sale page.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Download, ExternalLink, Loader2, Package, Printer, Search, X } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import type { AdminMarketplaceProfilePickerRow } from "@/lib/services/adminStartMarketplaceConversation"
import type { AdminUserLabelContext } from "@/lib/services/adminUserShippingLabel"
import { validateLabelParcelEntry } from "@/lib/shipping/surfboard-label-limits"
import type { AddressFields } from "./address-fields"
import { AddressForm } from "./shipping-address-form"

type RateRow = {
  rate_id: string
  carrierLabel: string
  serviceName: string
  amount: number
  currency: string
}

const EMPTY_PARCEL = {
  length_in: "",
  width_in: "",
  height_in: "",
  weight_lb: "",
}

const EMPTY_SHIP_TO: AddressFields = {
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

function parseParcel(parcel: typeof EMPTY_PARCEL) {
  return {
    lengthIn: Number(parcel.length_in),
    widthIn: Number(parcel.width_in),
    heightIn: Number(parcel.height_in),
    weightLb: Number(parcel.weight_lb),
  }
}

function openLabelPdf(url: string) {
  window.open(url, "_blank", "noopener,noreferrer")
}

async function downloadLabelPdf(url: string, trackingNumber: string) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = href
    a.download = `reswell-label-${trackingNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href)
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

export function AdminUserLabelPurchase() {
  const [searchQ, setSearchQ] = useState("")
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchHits, setSearchHits] = useState<AdminMarketplaceProfilePickerRow[]>([])
  const [selectedUser, setSelectedUser] = useState<AdminMarketplaceProfilePickerRow | null>(null)

  const [context, setContext] = useState<AdminUserLabelContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [addressId, setAddressId] = useState("")
  const [shipTo, setShipTo] = useState<AddressFields>(EMPTY_SHIP_TO)
  const [parcel, setParcel] = useState(EMPTY_PARCEL)

  const [ratesBusy, setRatesBusy] = useState(false)
  const [rates, setRates] = useState<RateRow[] | null>(null)
  const [selectedRateId, setSelectedRateId] = useState("")
  const [purchaseBusy, setPurchaseBusy] = useState(false)
  const [labelReadyOpen, setLabelReadyOpen] = useState(false)
  const [labelReady, setLabelReady] = useState<{
    labelUrl: string | null
    trackingNumber: string
    messageSent: boolean
    conversationId: string | null
  } | null>(null)

  const loadUser = useCallback(async (user: AdminMarketplaceProfilePickerRow) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/shipping/user-label?user_id=${encodeURIComponent(user.id)}`, {
        credentials: "include",
      })
      const body = (await res.json()) as { data?: AdminUserLabelContext; error?: string }
      if (!res.ok || !body.data) {
        toast.error(body.error ?? "Could not load user")
        setContext(null)
        return
      }
      setContext(body.data)
      const preferred = body.data.addresses.find((a) => a.isDefault) ?? body.data.addresses[0]
      setAddressId(preferred?.id ?? "")
      setShipTo(
        preferred?.fields ?? {
          ...EMPTY_SHIP_TO,
          name: body.data.user.display_name?.trim() || "",
        },
      )
      setRates(null)
      setSelectedRateId("")
    } catch {
      toast.error("Could not load user")
      setContext(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const q = searchQ.trim()
    if (selectedUser || q.length < 2) {
      if (!selectedUser) setSearchHits([])
      return
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setSearchBusy(true)
        try {
          const params = new URLSearchParams()
          params.set("q", q)
          params.set("limit", "20")
          const res = await fetch(`/api/admin/marketplace-conversations/user-search?${params}`, {
            credentials: "include",
          })
          const body = (await res.json()) as {
            data?: AdminMarketplaceProfilePickerRow[]
            error?: string
          }
          if (!res.ok) {
            setSearchHits([])
            toast.error(body.error ?? "Search failed")
            return
          }
          setSearchHits(body.data ?? [])
        } catch {
          setSearchHits([])
          toast.error("Search failed")
        } finally {
          setSearchBusy(false)
        }
      })()
    }, 300)
    return () => window.clearTimeout(t)
  }, [searchQ, selectedUser])

  const selectUser = (user: AdminMarketplaceProfilePickerRow) => {
    setSelectedUser(user)
    setSearchQ(user.display_name?.trim() || user.email || user.id)
    setSearchHits([])
    void loadUser(user)
  }

  const clearUser = () => {
    setSelectedUser(null)
    setContext(null)
    setSearchQ("")
    setSearchHits([])
    setAddressId("")
    setShipTo(EMPTY_SHIP_TO)
    setParcel(EMPTY_PARCEL)
    setRates(null)
    setSelectedRateId("")
  }

  const applySavedAddress = (id: string) => {
    setAddressId(id)
    const match = context?.addresses.find((a) => a.id === id)
    if (match) setShipTo(match.fields)
    setRates(null)
    setSelectedRateId("")
  }

  const requestRates = async () => {
    if (!selectedUser) return
    const parsed = parseParcel(parcel)
    const parcelCheck = validateLabelParcelEntry(parsed)
    if (!parcelCheck.ok) {
      toast.error(parcelCheck.error)
      return
    }
    if (!shipTo.name.trim() || !shipTo.address_line1.trim() || !shipTo.city_locality.trim() || !shipTo.postal_code.trim()) {
      toast.error("Enter a complete ship-to address.")
      return
    }

    setRatesBusy(true)
    setRates(null)
    setSelectedRateId("")
    try {
      const res = await fetch("/api/admin/shipping/user-label", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rates",
          user_id: selectedUser.id,
          parcel: {
            length_in: parsed.lengthIn,
            width_in: parsed.widthIn,
            height_in: parsed.heightIn,
            weight_lb: parsed.weightLb,
          },
          ship_to: shipTo,
        }),
      })
      const data = (await res.json()) as { data?: { rates: RateRow[] }; error?: string }
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
    if (!selectedUser || !selectedRateId) return
    const parsed = parseParcel(parcel)
    const parcelCheck = validateLabelParcelEntry(parsed)
    if (!parcelCheck.ok) {
      toast.error(parcelCheck.error)
      return
    }

    setPurchaseBusy(true)
    try {
      const res = await fetch("/api/admin/shipping/user-label", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purchase",
          user_id: selectedUser.id,
          rate_id: selectedRateId,
          parcel: {
            length_in: parsed.lengthIn,
            width_in: parsed.widthIn,
            height_in: parsed.heightIn,
            weight_lb: parsed.weightLb,
          },
          ship_to: shipTo,
        }),
      })
      const data = (await res.json()) as {
        data?: {
          labelUrl: string | null
          trackingNumber: string
          messageSent: boolean
          conversationId: string | null
          costUsd: number | null
        }
        error?: string
      }
      if (!res.ok || !data.data) {
        const msg = data.error?.trim() || "Could not buy label"
        toast.error(msg.length > 600 ? `${msg.slice(0, 600)}…` : msg, { duration: 12_000 })
        return
      }
      setLabelReady({
        labelUrl: data.data.labelUrl,
        trackingNumber: data.data.trackingNumber,
        messageSent: data.data.messageSent,
        conversationId: data.data.conversationId,
      })
      setLabelReadyOpen(true)
      if (data.data.messageSent) {
        toast.success(`Label purchased. Tracking ${data.data.trackingNumber} — member notified.`)
      } else {
        toast.success(`Label purchased. Tracking ${data.data.trackingNumber}.`)
        toast.error("Label bought, but the member message could not be sent.")
      }
      setRates(null)
      setSelectedRateId("")
    } catch {
      toast.error("Could not buy label")
    } finally {
      setPurchaseBusy(false)
    }
  }

  const selectedRate = rates?.find((r) => r.rate_id === selectedRateId) ?? null
  const memberName = context?.user.display_name?.trim() || selectedUser?.display_name?.trim() || "Member"

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border bg-card">
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Package className="h-4 w-4" aria-hidden />
            </span>
            <div className="space-y-1">
              <CardTitle className="text-lg">Send a package to a member</CardTitle>
              <CardDescription>
                Search for the member, enter the box size, and buy a ShipEngine label from Reswell&apos;s
                warehouse. They get a message that a package is on the way.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {selectedUser ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  {selectedUser.avatar_url ? <AvatarImage src={selectedUser.avatar_url} alt="" /> : null}
                  <AvatarFallback className="text-xs">
                    {(selectedUser.display_name ?? selectedUser.email ?? "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{memberName}</p>
                  {selectedUser.email ? (
                    <p className="truncate text-xs text-muted-foreground">{selectedUser.email}</p>
                  ) : null}
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5 rounded-xl" onClick={clearUser}>
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="admin-user-label-search">Find member</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-user-label-search"
                  className="h-11 rounded-xl pl-9"
                  placeholder="Search by name or email…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
              </div>
              {searchBusy ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching…
                </p>
              ) : null}
              {searchHits.length > 0 ? (
                <div
                  className="max-h-56 overflow-auto rounded-xl border border-border bg-background shadow-sm"
                  role="listbox"
                >
                  {searchHits.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      role="option"
                      className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left text-sm last:border-0 hover:bg-muted/50"
                      onClick={() => selectUser(row)}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        {row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
                        <AvatarFallback className="text-xs">
                          {(row.display_name ?? row.email ?? "?")[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {row.display_name?.trim() || "Unnamed member"}
                        </span>
                        {row.email ? (
                          <span className="block truncate text-xs text-muted-foreground">{row.email}</span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {selectedUser && loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading addresses…
            </p>
          ) : null}

          {context ? (
            <>
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Ship from:</span>{" "}
                  <span className="font-medium text-foreground">{context.shipFrom.name}</span>
                  <span className="text-muted-foreground"> · {context.shipFrom.oneLine}</span>
                </p>
              </div>

              {context.addresses.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="admin-user-ship-to">Saved address</Label>
                  <Select value={addressId} onValueChange={applySavedAddress}>
                    <SelectTrigger id="admin-user-ship-to" className="h-11 rounded-xl">
                      <SelectValue placeholder="Select address" />
                    </SelectTrigger>
                    <SelectContent>
                      {context.addresses.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label} — {a.oneLine}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This member has no saved address. Enter the ship-to below.
                </p>
              )}

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Ship to</p>
                <AddressForm
                  value={shipTo}
                  onChange={(next) => {
                    setShipTo(next)
                    setRates(null)
                    setSelectedRateId("")
                  }}
                  inputClassName="h-11 rounded-xl"
                  selectTriggerClassName="h-11 rounded-xl"
                  formId="admin-user-label-ship-to"
                />
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground">Box size</p>
                <p className="text-sm text-muted-foreground">
                  Packed carton Reswell will ship. Length is the longest side.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="user-label-L">Length (in)</Label>
                    <Input
                      id="user-label-L"
                      inputMode="decimal"
                      placeholder="e.g. 12"
                      value={parcel.length_in}
                      onChange={(e) => {
                        setParcel({ ...parcel, length_in: e.target.value })
                        setRates(null)
                        setSelectedRateId("")
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-label-W">Width (in)</Label>
                    <Input
                      id="user-label-W"
                      inputMode="decimal"
                      placeholder="e.g. 9"
                      value={parcel.width_in}
                      onChange={(e) => {
                        setParcel({ ...parcel, width_in: e.target.value })
                        setRates(null)
                        setSelectedRateId("")
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-label-H">Height (in)</Label>
                    <Input
                      id="user-label-H"
                      inputMode="decimal"
                      placeholder="e.g. 6"
                      value={parcel.height_in}
                      onChange={(e) => {
                        setParcel({ ...parcel, height_in: e.target.value })
                        setRates(null)
                        setSelectedRateId("")
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-label-Wt">Weight (lb)</Label>
                    <Input
                      id="user-label-Wt"
                      inputMode="decimal"
                      placeholder="e.g. 2"
                      value={parcel.weight_lb}
                      onChange={(e) => {
                        setParcel({ ...parcel, weight_lb: e.target.value })
                        setRates(null)
                        setSelectedRateId("")
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="rounded-xl" disabled={ratesBusy} onClick={() => void requestRates()}>
                  {ratesBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Get rates
                </Button>
              </div>

              {rates && rates.length > 0 ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/40 hover:bg-transparent">
                          <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Carrier
                          </TableHead>
                          <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Service
                          </TableHead>
                          <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Price
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rates.map((row) => (
                          <TableRow
                            key={row.rate_id}
                            className={row.rate_id === selectedRateId ? "bg-violet-500/5" : undefined}
                            onClick={() => setSelectedRateId(row.rate_id)}
                          >
                            <TableCell>
                              <button type="button" className="text-left font-medium" onClick={() => setSelectedRateId(row.rate_id)}>
                                {row.carrierLabel}
                              </button>
                            </TableCell>
                            <TableCell>{row.serviceName}</TableCell>
                            <TableCell className="tabular-nums">
                              ${row.amount.toFixed(2)} {row.currency}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <Button
                    type="button"
                    className="h-11 px-6"
                    disabled={purchaseBusy || !selectedRateId}
                    onClick={() => void buyLabel()}
                  >
                    {purchaseBusy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="mr-2 h-4 w-4" />
                    )}
                    {selectedRate
                      ? `Buy label — $${selectedRate.amount.toFixed(2)}`
                      : "Buy label"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Charges your ShipEngine account. The member is messaged automatically with tracking.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

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
                  Tracking <span className="font-mono text-foreground">{labelReady.trackingNumber}</span>
                  {labelReady.messageSent
                    ? " — the member was told a package is on the way."
                    : " — the label was purchased, but the member message did not send."}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {labelReady?.labelUrl ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="flex-1 gap-2 rounded-xl" onClick={() => openLabelPdf(labelReady.labelUrl as string)}>
                <ExternalLink className="h-4 w-4" />
                Open PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 gap-2 rounded-xl"
                onClick={() => void downloadLabelPdf(labelReady.labelUrl as string, labelReady.trackingNumber)}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          ) : labelReady ? (
            <p className="text-sm text-muted-foreground">
              No direct PDF URL was returned. Tracking is still valid — check ShipEngine.
            </p>
          ) : null}
          <DialogFooter className="sm:justify-start">
            {labelReady?.conversationId ? (
              <Button type="button" variant="outline" className="rounded-xl" asChild>
                <Link href={`/admin/messages/${labelReady.conversationId}`}>Open thread</Link>
              </Button>
            ) : null}
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

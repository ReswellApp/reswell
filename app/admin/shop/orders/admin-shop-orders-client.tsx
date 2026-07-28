"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Package,
  RefreshCw,
  Store,
  Truck,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { AdminReswellShopFulfillForm } from "@/components/features/admin/admin-reswell-shop-fulfill-form"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { deliveryStatusLabel } from "@/lib/order-status"
import { cn } from "@/lib/utils"
import type { AdminReswellShopOrderRow } from "@/lib/db/adminReswellShopOrders"

type Counts = {
  total: number
  awaiting_shipment: number
  shipped: number
  delivered: number
}

type FulfillmentFilter = "all" | "awaiting_shipment" | "shipped" | "delivered"

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function buyerLabel(row: AdminReswellShopOrderRow): string {
  if (row.buyer?.display_name?.trim()) return row.buyer.display_name.trim()
  if (row.buyer?.email?.trim()) return row.buyer.email.trim()
  if (row.shipping_address?.name?.trim()) return row.shipping_address.name.trim()
  if (row.shipping_address?.email?.trim()) return row.shipping_address.email.trim()
  return row.buyer_id ? `Buyer ${row.buyer_id.slice(0, 8)}` : "Guest"
}

function shipCityLine(row: AdminReswellShopOrderRow): string {
  const addr = row.shipping_address?.address
  if (!addr) return "—"
  return [addr.city, addr.state].filter(Boolean).join(", ") || "—"
}

export function AdminShopOrdersClient() {
  const [rows, setRows] = useState<AdminReswellShopOrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [fulfillment, setFulfillment] = useState<FulfillmentFilter>("awaiting_shipment")
  const [offset, setOffset] = useState(0)
  const [expandId, setExpandId] = useState<string | null>(null)
  const pageSize = 50

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setOffset(0)
  }, [search, fulfillment])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("fulfillment", fulfillment)
      params.set("limit", String(pageSize))
      params.set("offset", String(offset))
      if (search) params.set("q", search)

      const res = await fetch(`/api/admin/shop/orders?${params}`, { credentials: "include" })
      const body = (await res.json()) as {
        data?: AdminReswellShopOrderRow[]
        total?: number
        counts?: Counts
        error?: string
      }
      if (!res.ok) {
        throw new Error(body.error || "Could not load shop orders")
      }
      setRows(body.data ?? [])
      setTotal(body.total ?? 0)
      setCounts(body.counts ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load shop orders")
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [fulfillment, offset, search])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.floor(offset / pageSize) + 1

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-gradient-to-br from-stone-100 via-background to-stone-50 dark:from-stone-950 dark:via-background dark:to-stone-900">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 20%, rgba(28,28,28,0.08), transparent 42%), radial-gradient(circle at 88% 10%, rgba(28,28,28,0.06), transparent 36%)",
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4 px-5 py-6 sm:px-7">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-background/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
              <Store className="h-3.5 w-3.5" aria-hidden />
              Reswell shop
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Shop orders
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
              Fulfill Reswell retail orders from the shared orders table. Buy a ShipEngine label
              from the product package size — tracking is saved and Order Shipped fires in Klaviyo.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/admin/shop"
                className="text-sm text-foreground underline underline-offset-4"
              >
                Inventory
              </Link>
              <Link
                href="/reswell/shop"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Public shop <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/admin/orders"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                All marketplace orders
              </Link>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            {
              key: "awaiting_shipment" as const,
              label: "Awaiting shipment",
              value: counts?.awaiting_shipment,
              icon: Package,
            },
            {
              key: "shipped" as const,
              label: "Shipped",
              value: counts?.shipped,
              icon: Truck,
            },
            {
              key: "delivered" as const,
              label: "Delivered",
              value: counts?.delivered,
              icon: CheckCircle2,
            },
            {
              key: "all" as const,
              label: "All shop orders",
              value: counts?.total,
              icon: Store,
            },
          ] as const
        ).map((tile) => {
          const Icon = tile.icon
          const active = fulfillment === tile.key
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => setFulfillment(tile.key)}
              className={cn(
                "rounded-2xl border bg-card p-4 text-left transition-all duration-200 hover:border-foreground/20 hover:shadow-sm",
                active ? "border-foreground/30 ring-1 ring-foreground/10" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {tile.label}
                </span>
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">
                {tile.value == null ? "—" : tile.value}
              </p>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search order # or id…"
          className="max-w-xs"
        />
        <Select
          value={fulfillment}
          onValueChange={(v) => setFulfillment(v as FulfillmentFilter)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Fulfillment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="awaiting_shipment">Awaiting shipment</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Ship to</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-[140px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No Reswell shop orders in this view.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const displayNum = formatOrderNumForCustomer(row.order_num, row.id)
                const canFulfill =
                  row.status === "confirmed" &&
                  row.fulfillment_method === "shipping" &&
                  row.delivery_status === "pending"
                const expanded = expandId === row.id
                const created = new Date(row.created_at)
                return (
                  <Fragment key={row.id}>
                    <TableRow className={expanded ? "border-b-0" : undefined}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <Link
                            href={`/admin/orders/${row.id}`}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            #{displayNum}
                          </Link>
                          <p
                            className="text-xs text-muted-foreground"
                            title={Number.isNaN(created.getTime()) ? undefined : format(created, "PPpp")}
                          >
                            {Number.isNaN(created.getTime())
                              ? "—"
                              : formatDistanceToNow(created, { addSuffix: true })}
                          </p>
                          {row.is_admin_test ? (
                            <Badge variant="outline" className="text-[10px]">
                              Test
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="line-clamp-2 max-w-[220px] text-sm font-medium">
                          {row.listing_title ?? "Listing"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="line-clamp-1 max-w-[160px] text-sm">{buyerLabel(row)}</p>
                        {row.buyer?.email ? (
                          <p className="line-clamp-1 max-w-[160px] text-xs text-muted-foreground">
                            {row.buyer.email}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {shipCityLine(row)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className="capitalize">
                            {row.status}
                          </Badge>
                          {row.delivery_status ? (
                            <p className="text-xs text-muted-foreground">
                              {deliveryStatusLabel(row.delivery_status)}
                            </p>
                          ) : null}
                          {row.tracking_number ? (
                            <p className="font-mono text-[10px] text-muted-foreground break-all max-w-[140px]">
                              {row.tracking_number}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatUsd(row.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end gap-1.5">
                          {canFulfill ? (
                            <Button
                              type="button"
                              size="sm"
                              variant={expanded ? "secondary" : "default"}
                              className="gap-1.5"
                              onClick={() => setExpandId(expanded ? null : row.id)}
                            >
                              <Truck className="h-3.5 w-3.5" />
                              {expanded ? "Close" : "Buy label"}
                            </Button>
                          ) : null}
                          <Button type="button" size="sm" variant="ghost" asChild>
                            <Link href={`/admin/orders/${row.id}`}>Details</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded && canFulfill ? (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/20 py-4">
                          <AdminReswellShopFulfillForm
                            orderId={row.id}
                            onFulfilled={() => {
                              setExpandId(null)
                              void load()
                              toast.message("Order moved to shipped")
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {total > pageSize ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} · {total} orders
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => setOffset((o) => Math.max(0, o - pageSize))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset + pageSize >= total || loading}
              onClick={() => setOffset((o) => o + pageSize)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

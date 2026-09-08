"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  FlaskConical,
  Hash,
  Loader2,
  MoreVertical,
  RefreshCw,
  ShoppingBag,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SiteSearchBar, siteSearchInputClassName } from "@/components/site-search-bar"
import { AdminOrderSituationChip } from "@/components/features/admin/admin-order-situation-chip"
import {
  adminFulfillmentLabel,
  adminOrderSituation,
  adminPaymentLabel,
} from "@/lib/admin-order-situation"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import type { AdminOrdersDashboardStats } from "@/lib/services/adminOrdersStats"
import { cn } from "@/lib/utils"

type PartyLabel = { display_name: string | null; email: string | null; avatar_url: string | null }

export type AdminOrdersDeskRow = {
  id: string
  order_num: string | null
  status: string
  amount: number | string
  payment_method: string
  fulfillment_method: string | null
  created_at: string
  refunded_at: string | null
  buyer_id: string | null
  seller_id: string
  is_admin_test: boolean
  delivery_status: string | null
  tracking_number: string | null
  listing_id?: string | null
  listing_title: string | null
  buyer: PartyLabel | null
  seller: PartyLabel | null
}

type QueueId = "open" | "to_ship" | "pickup" | "needs_label" | "refunds" | "all"
type SortKey = "created_at" | "amount"
type SortDir = "asc" | "desc"

const PAGE_SIZE_OPTIONS = [25, 50, 100]

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value)
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function partyName(party: PartyLabel | null, fallbackId: string | null, guest = "Walk-in"): string {
  return party?.display_name?.trim() || party?.email?.trim() || (fallbackId ? `User ${fallbackId.slice(0, 8)}` : guest)
}

function userInitials(name: string | null, email: string | null): string {
  const base = (name?.trim() || email?.trim() || "?").replace(/@.*/, "")
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function readInitialQueue(): QueueId {
  if (typeof window === "undefined") return "all"
  const open = new URLSearchParams(window.location.search).get("open")
  const hash = window.location.hash.replace(/^#/, "")
  if (open === "shipping" || hash === "open-orders-shipping") return "to_ship"
  if (open === "pickup" || hash === "open-orders-pickup") return "pickup"
  if (open === "needs_label") return "needs_label"
  if (open === "all" || hash === "open-orders") return "open"
  return "all"
}

function queueToParams(queue: QueueId): { open: string; status: string } {
  switch (queue) {
    case "open":
      return { open: "all", status: "all" }
    case "to_ship":
      return { open: "shipping", status: "all" }
    case "pickup":
      return { open: "pickup", status: "all" }
    case "needs_label":
      return { open: "needs_label", status: "all" }
    case "refunds":
      return { open: "none", status: "refunds" }
    default:
      return { open: "none", status: "all" }
  }
}

function PartyAvatar({ party }: { party: PartyLabel | null }) {
  const avatarSrc = profileMediaDisplaySrc(party?.avatar_url)
  return (
    <Avatar className="h-6 w-6 ring-1 ring-border">
      {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
      <AvatarFallback className="bg-secondary text-[9px] font-semibold">
        {userInitials(party?.display_name ?? null, party?.email ?? null)}
      </AvatarFallback>
    </Avatar>
  )
}

export function AdminOrdersDesk() {
  const [rows, setRows] = useState<AdminOrdersDeskRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<AdminOrdersDashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [queue, setQueue] = useState<QueueId>("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [testFilter, setTestFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [pageSize, setPageSize] = useState(50)
  const [offset, setOffset] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<AdminOrdersDeskRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [queueReady, setQueueReady] = useState(false)

  useEffect(() => {
    const initial = readInitialQueue()
    setQueue(initial)
    if (initial !== "all" && initial !== "refunds") {
      setSortDir("asc")
    }
    setQueueReady(true)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setOffset(0)
  }, [search, queue, paymentFilter, testFilter, sortKey, sortDir, pageSize])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch("/api/admin/orders/stats", { credentials: "include" })
      const body = (await res.json()) as { data?: { stats?: AdminOrdersDashboardStats }; error?: string }
      if (res.ok && body.data?.stats) setStats(body.data.stats)
    } catch {
      /* non-fatal */
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    if (!queueReady) return
    setLoading(true)
    setError(null)
    try {
      const { open, status } = queueToParams(queue)
      const params = new URLSearchParams()
      if (open !== "none") params.set("open", open)
      else if (status !== "all") params.set("status", status)
      if (paymentFilter !== "all") params.set("payment", paymentFilter)
      if (testFilter !== "all") params.set("test", testFilter)
      if (search) params.set("q", search)
      params.set("sort", sortKey)
      params.set("dir", sortDir)
      params.set("limit", String(pageSize))
      params.set("offset", String(offset))

      const res = await fetch(`/api/admin/orders?${params}`, { credentials: "include" })
      const body = (await res.json()) as { data?: AdminOrdersDeskRow[]; total?: number; error?: string }
      if (!res.ok) throw new Error(body.error || "Could not load orders")
      setRows(body.data ?? [])
      setTotal(body.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load orders")
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [queueReady, queue, paymentFilter, testFilter, search, sortKey, sortDir, pageSize, offset])

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  const queues = useMemo(() => {
    const openUnfulfilled = stats?.openUnfulfilled ?? 0
    const shipping = stats?.openByMethod.shipping ?? 0
    const pickup = stats?.openByMethod.pickup ?? 0
    const needsLabel = stats?.needsLabel ?? 0
    const refunding = stats?.refunding ?? 0
    const refunded = stats?.refunded ?? 0
    return [
      {
        id: "open" as const,
        anchor: "open-orders",
        label: "Open",
        hint: "Not delivered or picked up",
        count: openUnfulfilled,
        warn: openUnfulfilled > 0,
      },
      {
        id: "to_ship" as const,
        anchor: "open-orders-shipping",
        label: "To ship",
        hint: needsLabel > 0 ? `${compactNumber(needsLabel)} need a label` : "Paid, not delivered",
        count: shipping,
        warn: needsLabel > 0,
      },
      {
        id: "pickup" as const,
        anchor: "open-orders-pickup",
        label: "Pickup",
        hint: "Waiting on handoff",
        count: pickup,
        warn: pickup > 0,
      },
      {
        id: "needs_label" as const,
        anchor: "needs-label",
        label: "Needs label",
        hint: "No tracking yet",
        count: needsLabel,
        warn: needsLabel > 0,
      },
      {
        id: "refunds" as const,
        anchor: "refunds",
        label: "Refunds",
        hint: refunding > 0 ? `${compactNumber(refunding)} in progress` : "Refunded history",
        count: refunding + refunded,
        warn: refunding > 0,
      },
      {
        id: "all" as const,
        anchor: "all-orders",
        label: "All",
        hint: "Every order",
        count: stats?.total ?? 0,
        warn: false,
      },
    ]
  }, [stats])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.floor(offset / pageSize) + 1
  const hasFilters = queue !== "all" || paymentFilter !== "all" || testFilter !== "all" || search !== ""
  const labelFailures = stats?.openLabelFailures ?? 0

  function selectQueue(next: QueueId) {
    setQueue(next)
    if (next === "all" || next === "refunds") {
      setSortKey("created_at")
      setSortDir("desc")
    } else {
      setSortKey("created_at")
      setSortDir("asc")
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error("Could not copy")
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/orders/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(body?.error ?? "Could not delete order")
        return
      }
      toast.success(`Test order ${deleteTarget.order_num ?? `#${deleteTarget.id.slice(0, 8)}`} deleted`)
      setDeleteTarget(null)
      void fetchOrders()
      void fetchStats()
    } catch {
      toast.error("Could not delete order")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">Orders</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Work through open fulfillment first. Each row says what is happening and what to do next.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/orders/test-purchase">
              <ShoppingBag className="mr-2 h-4 w-4" /> Test purchase
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => {
              void fetchOrders()
              void fetchStats()
            }}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {labelFailures > 0 ? (
        <Link
          href="/admin/shipping"
          className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] px-4 py-3 text-sm transition-colors hover:bg-rose-500/[0.1]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>
            <span className="font-medium text-foreground">
              {compactNumber(labelFailures)} shipping label {labelFailures === 1 ? "failure" : "failures"}
            </span>
            <span className="text-muted-foreground"> — open the shipping desk to retry or replace them.</span>
          </span>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        {queues.map((item) => {
          const selected = queue === item.id
          return (
            <button
              key={item.id}
              id={item.anchor}
              type="button"
              onClick={() => selectQueue(item.id)}
              className={cn(
                "scroll-mt-24 rounded-xl border px-3 py-3 text-left transition-colors",
                selected
                  ? "border-foreground/20 bg-foreground/[0.04] shadow-sm"
                  : "border-border bg-card hover:border-foreground/15 hover:bg-muted/30",
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p
                className={cn(
                  "mt-1 text-2xl font-bold tabular-nums tracking-tight",
                  item.warn && !selected ? "text-amber-700 dark:text-amber-400" : "text-foreground",
                )}
              >
                {statsLoading && !stats ? "—" : compactNumber(item.count)}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{item.hint}</p>
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SiteSearchBar className="flex-1 lg:min-w-0" onSubmit={(e) => e.preventDefault()}>
            <Input
              placeholder="Search order # or paste an order ID…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={siteSearchInputClassName()}
            />
          </SiteSearchBar>
          <div className="grid grid-cols-2 gap-2 sm:flex lg:shrink-0">
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="lg:w-36">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payments</SelectItem>
                <SelectItem value="stripe">Card</SelectItem>
                <SelectItem value="reswell_bucks">Wallet</SelectItem>
              </SelectContent>
            </Select>
            <Select value={testFilter} onValueChange={setTestFilter}>
              <SelectTrigger className="lg:w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All orders</SelectItem>
                <SelectItem value="real">Real only</SelectItem>
                <SelectItem value="test">Test only</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={`${sortKey}:${sortDir}`}
              onValueChange={(v) => {
                const [k, d] = v.split(":") as [SortKey, SortDir]
                setSortKey(k)
                setSortDir(d)
              }}
            >
              <SelectTrigger className="lg:w-44">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at:desc">Newest first</SelectItem>
                <SelectItem value="created_at:asc">Oldest first</SelectItem>
                <SelectItem value="amount:desc">Highest amount</SelectItem>
                <SelectItem value="amount:asc">Lowest amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading || !queueReady ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="h-10 w-28 animate-pulse rounded bg-muted" />
                <div className="h-5 w-32 animate-pulse rounded-full bg-muted" />
                <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="font-medium text-foreground">Couldn&apos;t load orders</p>
            <p className="max-w-md text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void fetchOrders()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="font-medium text-foreground">No orders in this queue</p>
            <p className="text-sm text-muted-foreground">
              {hasFilters ? "Try another queue, or clear search and filters." : "No orders have been placed yet."}
            </p>
            {hasFilters ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchInput("")
                  selectQueue("all")
                  setPaymentFilter("all")
                  setTestFilter("all")
                }}
              >
                Show all orders
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const situation = adminOrderSituation({
                status: row.status,
                fulfillment_method: row.fulfillment_method,
                delivery_status: row.delivery_status,
                tracking_number: row.tracking_number,
              })
              const created = new Date(row.created_at)
              const createdOk = !Number.isNaN(created.getTime())
              const buyer = partyName(row.buyer, row.buyer_id)
              const seller = partyName(row.seller, row.seller_id)
              return (
                <li key={row.id} className="group relative">
                  <Link
                    href={`/admin/orders/${row.id}`}
                    className="flex flex-col gap-3 px-4 py-3.5 pr-12 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 sm:w-[11.5rem]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground group-hover:underline">
                          {formatOrderNumForCustomer(row.order_num, row.id)}
                        </span>
                        {row.is_admin_test ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-violet-500/30 text-violet-600 dark:text-violet-400"
                          >
                            <FlaskConical className="h-3 w-3" /> Test
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {row.listing_title || "Marketplace order"}
                      </p>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminOrderSituationChip label={situation.label} tone={situation.tone} />
                        <span className="text-sm text-foreground">{situation.nextStep}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <PartyAvatar party={row.buyer} />
                          <span className="max-w-[140px] truncate">{buyer}</span>
                        </span>
                        <span aria-hidden>→</span>
                        <span className="inline-flex items-center gap-1.5">
                          <PartyAvatar party={row.seller} />
                          <span className="max-w-[140px] truncate">{seller}</span>
                        </span>
                        <span className="text-border">·</span>
                        <span>{adminFulfillmentLabel(row.fulfillment_method)}</span>
                        <span className="text-border">·</span>
                        <span>{adminPaymentLabel(row.payment_method)}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{formatUsd(Number(row.amount))}</p>
                      <p className="text-xs tabular-nums text-muted-foreground" title={createdOk ? format(created, "PPpp") : undefined}>
                        {createdOk ? formatDistanceToNow(created, { addSuffix: true }) : "—"}
                      </p>
                    </div>
                  </Link>

                  <div className="absolute right-2 top-2 sm:top-1/2 sm:-translate-y-1/2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Order actions">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void copy(row.id, "Order ID")}>
                          <Copy className="mr-2 h-4 w-4" /> Copy order ID
                        </DropdownMenuItem>
                        {row.order_num ? (
                          <DropdownMenuItem onClick={() => void copy(row.order_num as string, "Order #")}>
                            <Hash className="mr-2 h-4 w-4" /> Copy order #
                          </DropdownMenuItem>
                        ) : null}
                        {row.is_admin_test ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-rose-600 focus:text-rose-600 dark:text-rose-400"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete test order
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {!loading && !error && rows.length > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium tabular-nums text-foreground">
                {offset + 1}–{Math.min(offset + pageSize, total)}
              </span>{" "}
              of <span className="font-medium tabular-nums text-foreground">{compactNumber(total)}</span>
            </p>
            <div className="flex items-center gap-3">
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - pageSize))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs tabular-nums text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={offset + pageSize >= total}
                  onClick={() => setOffset(offset + pageSize)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete test order?</DialogTitle>
            <DialogDescription>
              This permanently removes test order{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.order_num ?? `#${deleteTarget?.id.slice(0, 8)}`}
              </span>
              . Only admin-seeded test orders can be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

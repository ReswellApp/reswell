"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  Tag,
  Ticket,
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
import { SiteSearchBar, siteSearchInputClassName } from "@/components/site-search-bar"
import { cn } from "@/lib/utils"
import type {
  AdminPromoCodeListRow,
  AdminPromoCodeSortKey,
  AdminPromoCodeStats,
  AdminPromoCodeStatusFilter,
} from "@/lib/types/admin-promo-codes"

const PAGE_SIZE_OPTIONS = [25, 50, 100]

type SortDir = "asc" | "desc"

const STATUS_LABEL: Record<AdminPromoCodeListRow["status"], string> = {
  active: "Active",
  reserved: "In checkout",
  redeemed: "Redeemed",
  expired: "Expired",
}

const STATUS_BADGE: Record<AdminPromoCodeListRow["status"], string> = {
  active: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  reserved: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  redeemed: "border-sky-500/30 text-sky-600 dark:text-sky-400",
  expired: "border-neutral-400/30 text-muted-foreground",
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  try {
    return format(new Date(value), "MMM d, yyyy")
  } catch {
    return "—"
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "—"
  try {
    return format(new Date(value), "MMM d, yyyy h:mm a")
  } catch {
    return "—"
  }
}

interface StatTileProps {
  label: string
  value: string
  hint?: string
  accent?: string
}

function StatTile({ label, value, hint, accent }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-3 text-2xl font-bold tabular-nums tracking-tight", accent ?? "text-foreground")}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function AdminPromoCodesClient() {
  const [rows, setRows] = useState<AdminPromoCodeListRow[]>([])
  const [stats, setStats] = useState<AdminPromoCodeStats | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<AdminPromoCodeStatusFilter>("all")
  const [sortKey, setSortKey] = useState<AdminPromoCodeSortKey>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, statusFilter, pageSize, sortKey, sortDir])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        sort: sortKey,
        dir: sortDir,
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      })
      if (debouncedQuery) params.set("q", debouncedQuery)

      const res = await fetch(`/api/admin/promo-codes?${params.toString()}`, {
        credentials: "include",
      })
      const body = (await res.json()) as {
        data?: { rows: AdminPromoCodeListRow[]; total: number; stats: AdminPromoCodeStats }
        error?: string
      }
      if (!res.ok) {
        throw new Error(body.error || "Could not load promo codes")
      }
      setRows(body.data?.rows ?? [])
      setTotal(body.data?.total ?? 0)
      setStats(body.data?.stats ?? null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load promo codes")
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, page, pageSize, sortDir, sortKey, statusFilter])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize

  function toggleSort(key: AdminPromoCodeSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "code" || key === "email" ? "asc" : "desc")
    }
  }

  const redemptionRate = useMemo(() => {
    if (!stats || stats.totalIssued <= 0) return "0%"
    return `${Math.round((stats.redeemed / stats.totalIssued) * 1000) / 10}%`
  }, [stats])

  function exportCsv() {
    const header = [
      "Code",
      "Email",
      "Status",
      "Discount %",
      "Created",
      "Expires",
      "Redeemed",
      "Order #",
      "Order discount",
      "Order amount",
    ]
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const lines = rows.map((r) =>
      [
        escape(r.code),
        escape(r.email),
        escape(STATUS_LABEL[r.status]),
        String(r.discountPercent),
        escape(formatDateTime(r.createdAt)),
        escape(formatDateTime(r.expiresAt)),
        escape(formatDateTime(r.redeemedAt)),
        escape(r.order?.orderNum ?? ""),
        r.order ? r.order.promoDiscountUsd.toFixed(2) : "",
        r.order ? r.order.amount.toFixed(2) : "",
      ].join(","),
    )
    const csv = [header.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reswell-promo-codes-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${rows.length} promo code${rows.length === 1 ? "" : "s"}`)
  }

  function SortHeader({
    label,
    sortKey: key,
    className,
  }: {
    label: string
    sortKey: AdminPromoCodeSortKey
    className?: string
  }) {
    const active = sortKey === key
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={cn(
          "inline-flex items-center gap-1 text-left font-medium transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
          className,
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">Promo codes</h1>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
              {loading ? "Loading…" : `${stats?.totalIssued ?? 0} issued`}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Newsletter welcome codes — track issuance, checkout holds, and redemptions on orders.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" disabled={loading || rows.length === 0} onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button type="button" variant="outline" disabled={loading} onClick={() => void fetchData()}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Issued" value={String(stats?.totalIssued ?? "—")} />
        <StatTile
          label="Active"
          value={String(stats?.active ?? "—")}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <StatTile
          label="In checkout"
          value={String(stats?.reserved ?? "—")}
          hint="Reserved at payment"
          accent="text-amber-600 dark:text-amber-400"
        />
        <StatTile
          label="Redeemed"
          value={String(stats?.redeemed ?? "—")}
          hint={stats ? `${redemptionRate} redemption rate` : undefined}
          accent="text-sky-600 dark:text-sky-400"
        />
        <StatTile label="Expired" value={String(stats?.expired ?? "—")} />
        <StatTile
          label="Total discount"
          value={stats ? formatUsd(stats.totalDiscountUsd) : "—"}
          hint="Reswell-funded on orders"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SiteSearchBar className="flex-1 lg:min-w-0" onSubmit={(e) => e.preventDefault()}>
            <Input
              placeholder="Search code, email, or order #…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={siteSearchInputClassName()}
            />
          </SiteSearchBar>
          <div className="grid grid-cols-2 gap-2 sm:flex lg:shrink-0">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as AdminPromoCodeStatusFilter)}
            >
              <SelectTrigger className="lg:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="reserved">In checkout</SelectItem>
                <SelectItem value="redeemed">Redeemed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={`${sortKey}:${sortDir}`}
              onValueChange={(v) => {
                const [k, d] = v.split(":") as [AdminPromoCodeSortKey, SortDir]
                setSortKey(k)
                setSortDir(d)
              }}
            >
              <SelectTrigger className="lg:w-52">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at:desc">Newest issued</SelectItem>
                <SelectItem value="created_at:asc">Oldest issued</SelectItem>
                <SelectItem value="expires_at:asc">Expiring soon</SelectItem>
                <SelectItem value="redeemed_at:desc">Recently redeemed</SelectItem>
                <SelectItem value="code:asc">Code A → Z</SelectItem>
                <SelectItem value="email:asc">Email A → Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {!loading && total > 0 ? (
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            {total} promo code{total === 1 ? "" : "s"} match
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading promo codes…
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10">
              <Ticket className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </span>
            <p className="mt-3 font-medium text-foreground">Couldn&apos;t load promo codes</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void fetchData()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Tag className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="mt-3 font-medium text-foreground">No promo codes found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>
                  <SortHeader label="Code" sortKey="code" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Email" sortKey="email" />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead>
                  <SortHeader label="Issued" sortKey="created_at" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Expires" sortKey="expires_at" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Redeemed" sortKey="redeemed_at" />
                </TableHead>
                <TableHead>Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm font-medium">{row.code}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">{row.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE[row.status]}>
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.discountPercent}%</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(row.expiresAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(row.redeemedAt)}
                  </TableCell>
                  <TableCell>
                    {row.order ? (
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/admin/orders/${row.order.id}`}
                          className="text-sm font-medium text-foreground hover:underline"
                        >
                          {row.order.orderNum}
                        </Link>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          −{formatUsd(row.order.promoDiscountUsd)} · {formatUsd(row.order.amount)} total
                        </span>
                      </div>
                    ) : row.reservedPaymentIntentId ? (
                      <span className="text-xs text-muted-foreground">Held at checkout</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && !loadError && rows.length > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium tabular-nums text-foreground">
                {pageStart + 1}–{Math.min(pageStart + pageSize, total)}
              </span>{" "}
              of <span className="font-medium tabular-nums text-foreground">{total}</span>
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
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

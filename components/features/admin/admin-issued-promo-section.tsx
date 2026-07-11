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
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { SiteSearchBar, siteSearchInputClassName } from "@/components/site-search-bar"
import { cn } from "@/lib/utils"
import {
  ADMIN_ISSUED_PROMO_MAX_PERCENT,
  ADMIN_ISSUED_PROMO_MIN_PERCENT,
  ADMIN_ISSUED_PROMO_VALIDITY_DAYS,
} from "@/lib/constants/admin-issued-promo"
import type {
  AdminIssuedPromoCodeListRow,
  AdminIssuedPromoCodeSortKey,
  AdminIssuedPromoCodeStats,
  AdminIssuedPromoCodeStatusFilter,
  AdminIssuedPromoGenerateResult,
} from "@/lib/types/admin-issued-promo-codes"

const PAGE_SIZE_OPTIONS = [25, 50, 100]

type SortDir = "asc" | "desc"

const STATUS_LABEL: Record<AdminIssuedPromoCodeListRow["status"], string> = {
  active: "Active",
  reserved: "In checkout",
  redeemed: "Redeemed",
  expired: "Expired",
}

const STATUS_BADGE: Record<AdminIssuedPromoCodeListRow["status"], string> = {
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

export function AdminIssuedPromoSection() {
  const [rows, setRows] = useState<AdminIssuedPromoCodeListRow[]>([])
  const [stats, setStats] = useState<AdminIssuedPromoCodeStats | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<AdminIssuedPromoCodeStatusFilter>("all")
  const [sortKey, setSortKey] = useState<AdminIssuedPromoCodeSortKey>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [discountPercent, setDiscountPercent] = useState("10")
  const [note, setNote] = useState("")
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<AdminIssuedPromoGenerateResult | null>(null)

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

      const res = await fetch(`/api/admin/promo-codes/admin-issued?${params.toString()}`, {
        credentials: "include",
      })
      const body = (await res.json()) as {
        data?: { rows: AdminIssuedPromoCodeListRow[]; total: number; stats: AdminIssuedPromoCodeStats }
        error?: string
      }
      if (!res.ok) {
        throw new Error(body.error || "Could not load admin promo codes")
      }
      setRows(body.data?.rows ?? [])
      setTotal(body.data?.total ?? 0)
      setStats(body.data?.stats ?? null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load admin promo codes")
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

  function toggleSort(key: AdminIssuedPromoCodeSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "code" || key === "discount_percent" ? "asc" : "desc")
    }
  }

  const redemptionRate = useMemo(() => {
    if (!stats || stats.totalIssued <= 0) return "0%"
    return `${Math.round((stats.redeemed / stats.totalIssued) * 1000) / 10}%`
  }, [stats])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number.parseInt(discountPercent, 10)
    if (
      !Number.isFinite(parsed) ||
      parsed < ADMIN_ISSUED_PROMO_MIN_PERCENT ||
      parsed > ADMIN_ISSUED_PROMO_MAX_PERCENT
    ) {
      toast.error(`Enter a discount between ${ADMIN_ISSUED_PROMO_MIN_PERCENT}% and ${ADMIN_ISSUED_PROMO_MAX_PERCENT}%.`)
      return
    }

    setGenerating(true)
    try {
      const res = await fetch("/api/admin/promo-codes/admin-issued", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discount_percent: parsed,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      })
      const body = (await res.json()) as { data?: AdminIssuedPromoGenerateResult; error?: string }
      if (!res.ok || !body.data) {
        throw new Error(body.error || "Could not generate promo code")
      }
      setGenerated(body.data)
      setNote("")
      toast.success("Promo code generated")
      void fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate promo code")
    } finally {
      setGenerating(false)
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Could not copy to clipboard")
    }
  }

  function SortHeader({
    label,
    sortKey: key,
    className,
  }: {
    label: string
    sortKey: AdminIssuedPromoCodeSortKey
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
    <section className="space-y-6 border-t border-border pt-10">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">Admin promo codes</h2>
          <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
            {loading ? "Loading…" : `${stats?.totalIssued ?? 0} issued`}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          One-time codes for any signed-in buyer — set the discount, share the code, and track redemption.
          Codes expire after {ADMIN_ISSUED_PROMO_VALIDITY_DAYS} days.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <form onSubmit={(e) => void handleGenerate(e)} className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            Generate a code
          </div>
          <div className="grid gap-4 sm:grid-cols-[140px_1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="admin-promo-discount">Discount %</Label>
              <Input
                id="admin-promo-discount"
                type="number"
                min={ADMIN_ISSUED_PROMO_MIN_PERCENT}
                max={ADMIN_ISSUED_PROMO_MAX_PERCENT}
                step={1}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                disabled={generating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-promo-note">Internal note (optional)</Label>
              <Input
                id="admin-promo-note"
                placeholder="e.g. VIP customer, support goodwill…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                disabled={generating}
              />
            </div>
            <Button type="submit" disabled={generating}>
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Generate
            </Button>
          </div>
        </form>

        {generated ? (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              New code ready
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="font-mono text-lg font-bold tracking-wide text-foreground">{generated.code}</span>
              <Badge variant="outline">{generated.discountPercent}% off items</Badge>
              <Button type="button" size="sm" variant="outline" onClick={() => void copyCode(generated.code)}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Expires {formatDate(generated.expiresAt)} · Single use · Reswell-funded (sellers unaffected)
            </p>
          </div>
        ) : null}
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
              placeholder="Search code, note, or order #…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={siteSearchInputClassName()}
            />
          </SiteSearchBar>
          <div className="grid grid-cols-2 gap-2 sm:flex lg:shrink-0">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as AdminIssuedPromoCodeStatusFilter)}
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
            <Button type="button" variant="outline" disabled={loading} onClick={() => void fetchData()}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading admin promo codes…
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="font-medium text-foreground">Couldn&apos;t load admin promo codes</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void fetchData()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="font-medium text-foreground">No admin promo codes yet</p>
            <p className="text-sm text-muted-foreground">Generate a one-time code above.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>
                  <SortHeader label="Code" sortKey="code" />
                </TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Discount" sortKey="discount_percent" className="justify-end" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Created" sortKey="created_at" />
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
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{row.code}</span>
                      {row.status === "active" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => void copyCode(row.code)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                    {row.note ?? "—"}
                  </TableCell>
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
    </section>
  )
}

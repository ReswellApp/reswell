"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  MessageSquare,
  RotateCcw,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SiteSearchBar, siteSearchInputClassName } from "@/components/site-search-bar"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { cn } from "@/lib/utils"

type PartyLabel = { display_name: string | null; email: string | null; avatar_url: string | null }

type NotificationRow = {
  messageId: string
  sentAt: string
  conversationId: string
  orderId: string
  orderNum: string
  listingTitle: string
  listingTitles?: string[]
  buyerId: string
  sellerId: string
  buyer: PartyLabel | null
  seller: PartyLabel | null
}

type NotificationStats = {
  totalSent: number
  uniqueSellersNotified: number
  uniqueOrdersCovered: number
  refundedOrdersTotal: number
  coverageGap: number
  last7Days: number
}

const PAGE_SIZE = 50

function userInitials(name: string | null, email: string | null): string {
  const base = (name?.trim() || email?.trim() || "?").replace(/@.*/, "")
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function PartyCell({
  party,
  userId,
}: {
  party: PartyLabel | null
  userId: string
}) {
  const name = party?.display_name || party?.email || `User ${userId.slice(0, 8)}`
  const avatarSrc = profileMediaDisplaySrc(party?.avatar_url)
  const initials = userInitials(party?.display_name ?? null, party?.email ?? null)

  return (
    <Link
      href={`/admin/users/${userId}`}
      className="group flex items-center gap-2 rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Avatar className="h-7 w-7 ring-1 ring-border">
        {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
        <AvatarFallback className="bg-secondary text-[10px] font-semibold text-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="line-clamp-1 max-w-[160px] text-sm text-foreground group-hover:underline">
          {name}
        </span>
        {party?.email ? (
          <span className="line-clamp-1 max-w-[160px] text-[11px] text-muted-foreground">
            {party.email}
          </span>
        ) : null}
      </span>
    </Link>
  )
}

interface StatTileProps {
  icon: typeof MessageSquare
  accent: "neutral" | "amber" | "rose" | "sky" | "violet"
  label: string
  value: string
  hint?: string
}

const STAT_ACCENT: Record<StatTileProps["accent"], string> = {
  neutral: "bg-secondary text-foreground",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
}

function StatTile({ icon: Icon, accent, label, value, hint }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-foreground/15 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", STAT_ACCENT[accent])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold leading-none tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function RefundThreadNotificationsAdminClient() {
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [userIdFilter, setUserIdFilter] = useState("")
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setOffset(0)
  }, [search, userIdFilter])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/refund-thread-notifications/stats", { credentials: "include" })
      const body = (await res.json()) as { data?: NotificationStats; error?: string }
      if (res.ok && body.data) setStats(body.data)
    } catch {
      /* non-fatal */
    }
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set("q", search)
      if (userIdFilter.trim()) params.set("userId", userIdFilter.trim())
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(offset))

      const res = await fetch(`/api/admin/refund-thread-notifications?${params}`, {
        credentials: "include",
      })
      const body = (await res.json()) as {
        data?: NotificationRow[]
        total?: number
        error?: string
      }
      if (!res.ok) {
        throw new Error(body.error || "Could not load refund notifications")
      }
      setRows(body.data ?? [])
      setTotal(body.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load refund notifications")
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [search, userIdFilter, offset])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < total

  const uniqueSellersInView = useMemo(() => {
    const ids = new Set(rows.map((r) => r.sellerId))
    return ids.size
  }, [rows])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Refund thread notifications
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          In-thread /messages sent to sellers when orders are refunded or auto-cancelled. Each row is
          one notification — the seller is the primary recipient.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          icon={MessageSquare}
          accent="rose"
          label="Messages sent"
          value={stats ? String(stats.totalSent) : "—"}
          hint="Total refund notifications in marketplace threads"
        />
        <StatTile
          icon={Users}
          accent="violet"
          label="Sellers notified"
          value={stats ? String(stats.uniqueSellersNotified) : "—"}
          hint="Unique sellers who received a refund message"
        />
        <StatTile
          icon={RotateCcw}
          accent="amber"
          label="Orders covered"
          value={stats ? String(stats.uniqueOrdersCovered) : "—"}
          hint={`Of ${stats?.refundedOrdersTotal ?? "—"} refunded real orders`}
        />
        <StatTile
          icon={RotateCcw}
          accent="neutral"
          label="Coverage gap"
          value={stats ? String(stats.coverageGap) : "—"}
          hint="Refunded orders missing a thread notification"
        />
        <StatTile
          icon={MessageSquare}
          accent="sky"
          label="Last 7 days"
          value={stats ? String(stats.last7Days) : "—"}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <SiteSearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search order # or order ID…"
          className={cn(siteSearchInputClassName, "sm:max-w-xs")}
        />
        <Input
          value={userIdFilter}
          onChange={(e) => setUserIdFilter(e.target.value)}
          placeholder="Filter by user UUID (buyer or seller)…"
          className="h-10 rounded-xl sm:max-w-xs"
        />
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          disabled={loading}
          onClick={() => {
            void fetchRows()
            void fetchStats()
          }}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Refreshing
            </>
          ) : (
            "Refresh"
          )}
        </Button>
        {!loading && rows.length > 0 ? (
          <Badge variant="secondary" className="ml-auto w-fit">
            {uniqueSellersInView} seller{uniqueSellersInView === 1 ? "" : "s"} on this page
          </Badge>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading notifications…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No refund thread notifications found.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">Sent</TableHead>
                <TableHead className="w-[100px]">Order</TableHead>
                <TableHead>Listing</TableHead>
                <TableHead>Seller notified</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead className="w-[100px]">Thread</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const sentDate = new Date(row.sentAt)
                const sentTitle = Number.isNaN(sentDate.getTime())
                  ? row.sentAt
                  : format(sentDate, "PPpp")
                const sentRelative = Number.isNaN(sentDate.getTime())
                  ? "—"
                  : formatDistanceToNow(sentDate, { addSuffix: true })

                return (
                  <TableRow key={row.messageId}>
                    <TableCell className="align-top whitespace-nowrap text-xs text-muted-foreground">
                      <span title={sentTitle}>{sentRelative}</span>
                    </TableCell>
                    <TableCell className="align-top">
                      <Link
                        href={`/admin/orders/${row.orderId}`}
                        className="font-mono text-sm font-medium text-foreground hover:underline"
                      >
                        #{row.orderNum}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px] align-top text-sm">
                      {row.listingTitles?.length ? (
                        <ul className="space-y-0.5">
                          {row.listingTitles.map((title) => (
                            <li key={title} className="line-clamp-2">
                              {title}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="line-clamp-2">{row.listingTitle}</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <PartyCell party={row.seller} userId={row.sellerId} />
                    </TableCell>
                    <TableCell className="align-top">
                      <PartyCell party={row.buyer} userId={row.buyerId} />
                    </TableCell>
                    <TableCell className="align-top">
                      <Button variant="link" className="h-auto p-0 text-sm" asChild>
                        <Link href={`/admin/messages/${row.conversationId}`}>
                          Open
                          <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Page {page} of {pageCount} · {total} notification{total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={!canPrev || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={!canNext || loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

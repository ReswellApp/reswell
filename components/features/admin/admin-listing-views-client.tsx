"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import { Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Badge } from "@/components/ui/badge"
import { listingDetailHref } from "@/lib/listing-href"
import { capitalizeWords } from "@/lib/listing-labels"
import type {
  AdminListingViewsDashboard,
  AdminListingViewsPeriod,
} from "@/lib/types/adminListingViews"
import { cn } from "@/lib/utils"

const PERIOD_OPTIONS: { value: AdminListingViewsPeriod; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
]

function fmt(n: number): string {
  return n.toLocaleString()
}

function rel(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

function abs(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy h:mm a")
  } catch {
    return iso
  }
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent> : null}
    </Card>
  )
}

export function AdminListingViewsClient() {
  const [period, setPeriod] = useState<AdminListingViewsPeriod>("7d")
  const [page, setPage] = useState(1)
  const [userIdInput, setUserIdInput] = useState("")
  const [listingIdInput, setListingIdInput] = useState("")
  const [appliedUserId, setAppliedUserId] = useState<string | undefined>()
  const [appliedListingId, setAppliedListingId] = useState<string | undefined>()
  const [data, setData] = useState<AdminListingViewsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        period,
        page: String(page),
        pageSize: "50",
      })
      if (appliedUserId) params.set("userId", appliedUserId)
      if (appliedListingId) params.set("listingId", appliedListingId)

      const res = await fetch(`/api/admin/listing-views?${params.toString()}`)
      const json = (await res.json()) as {
        data?: AdminListingViewsDashboard
        error?: string
      }
      if (!res.ok || !json.data) {
        setData(null)
        setError(json.error || "Could not load listing views")
        return
      }
      setData(json.data)
    } catch {
      setData(null)
      setError("Could not load listing views")
    } finally {
      setLoading(false)
    }
  }, [period, page, appliedUserId, appliedListingId])

  useEffect(() => {
    void load()
  }, [load])

  function applyFilters() {
    const uid = userIdInput.trim()
    const lid = listingIdInput.trim()
    setAppliedUserId(uid || undefined)
    setAppliedListingId(lid || undefined)
    setPage(1)
  }

  function clearFilters() {
    setUserIdInput("")
    setListingIdInput("")
    setAppliedUserId(undefined)
    setAppliedListingId(undefined)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Listing views</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed-in users’ detail-page history — who viewed which listings and how often.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={period}
            onValueChange={(v) => {
              setPeriod(v as AdminListingViewsPeriod)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-lv-user">
            User ID
          </label>
          <Input
            id="admin-lv-user"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            placeholder="uuid"
            className="font-mono text-xs"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-lv-listing">
            Listing ID
          </label>
          <Input
            id="admin-lv-listing"
            value={listingIdInput}
            onChange={(e) => setListingIdInput(e.target.value)}
            placeholder="uuid"
            className="font-mono text-xs"
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={applyFilters}>
            Apply
          </Button>
          <Button type="button" variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Unique viewers"
          value={data ? fmt(data.summary.uniqueViewers) : "—"}
          hint="Distinct signed-in users in range"
        />
        <StatTile
          label="Listings viewed"
          value={data ? fmt(data.summary.distinctListings) : "—"}
          hint="Distinct listings with at least one view"
        />
        <StatTile
          label="Total view events"
          value={data ? fmt(data.summary.totalViewEvents) : "—"}
          hint="Sum of per-user view counts"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Viewer history</CardTitle>
          <CardDescription>
            {data
              ? `${fmt(data.totalRows)} rows · page ${data.page} of ${data.totalPages}`
              : "Loading…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Listing</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead>First viewed</TableHead>
                <TableHead>Last viewed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : null}
              {data?.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No signed-in listing views in this range.
                  </TableCell>
                </TableRow>
              ) : null}
              {data?.rows.map((row) => {
                const userLabel =
                  row.userDisplayName?.trim() || row.userEmail?.trim() || row.userId.slice(0, 8)
                const listingHref = listingDetailHref({
                  id: row.listingId,
                  slug: row.listingSlug,
                  section: row.listingSection,
                })
                return (
                  <TableRow key={`${row.userId}:${row.listingId}`}>
                    <TableCell className="align-top">
                      <Link
                        href={`/admin/users/${row.userId}`}
                        className="font-medium hover:underline"
                      >
                        {userLabel}
                      </Link>
                      {row.userEmail ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {row.userEmail}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">
                      <Link href={listingHref} className="font-medium hover:underline">
                        {capitalizeWords(row.listingTitle)}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {row.listingStatus}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{row.listingSection}</span>
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-right tabular-nums font-semibold">
                      {fmt(row.viewCount)}
                    </TableCell>
                    <TableCell className="align-top">
                      <p className="text-sm">{rel(row.firstViewedAt)}</p>
                      <p className="text-xs text-muted-foreground">{abs(row.firstViewedAt)}</p>
                    </TableCell>
                    <TableCell className="align-top">
                      <p className="text-sm">{rel(row.lastViewedAt)}</p>
                      <p className="text-xs text-muted-foreground">{abs(row.lastViewedAt)}</p>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {data && data.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className={cn("text-xs text-muted-foreground tabular-nums")}>
                Page {data.page} / {data.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

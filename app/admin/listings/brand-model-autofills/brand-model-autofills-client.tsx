"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { format, formatDistanceToNow } from "date-fns"
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Package,
  Sparkles,
  Tag,
} from "lucide-react"
import { toast } from "sonner"
import { listingDetailHref } from "@/lib/listing-href"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { capitalizeWords } from "@/lib/listing-labels"
import { cn } from "@/lib/utils"
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

type AutofillRow = {
  id: string
  createdAt: string
  listingId: string
  listingTitle: string
  listingSlug: string | null
  listingSection: string
  listingStatus: string | null
  primaryImageUrl: string | null
  attachedBrand: boolean
  attachedModel: boolean
  brandName: string | null
  modelName: string | null
  currentBrand: string | null
  currentModel: string | null
  brandStillLinked: boolean
  modelStillLinked: boolean
  listingDeleted: boolean
}

type AutofillSummary = {
  total: number
  brandAttached: number
  modelAttached: number
  changedSince: number
}

type ApiResponse = {
  data?: { rows?: AutofillRow[]; summary?: AutofillSummary }
  error?: string
}

type StatusFilter = "all" | "brand" | "model" | "changed"

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof Tag
  label: string
  value: string
  hint?: string
  accent: "neutral" | "emerald" | "sky" | "amber"
}) {
  const accentClass = {
    neutral: "bg-secondary text-foreground",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }[accent]

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accentClass)}>
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

export function BrandModelAutofillsAdminClient() {
  const [rows, setRows] = useState<AutofillRow[]>([])
  const [summary, setSummary] = useState<AutofillSummary>({
    total: 0,
    brandAttached: 0,
    modelAttached: 0,
    changedSince: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/listings/brand-model-autofills", {
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as ApiResponse
      if (!res.ok) {
        toast.error(json.error || "Could not load autofills")
        setRows([])
        return
      }
      setRows(Array.isArray(json.data?.rows) ? json.data!.rows : [])
      if (json.data?.summary) setSummary(json.data.summary)
    } catch {
      toast.error("Could not load autofills")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter === "brand" && !row.attachedBrand) return false
      if (statusFilter === "model" && !row.attachedModel) return false
      if (statusFilter === "changed") {
        const drifted =
          row.listingDeleted ||
          (row.attachedBrand && !row.brandStillLinked) ||
          (row.attachedModel && !row.modelStillLinked)
        if (!drifted) return false
      }
      if (!q) return true
      return (
        row.listingTitle.toLowerCase().includes(q) ||
        (row.brandName ?? "").toLowerCase().includes(q) ||
        (row.modelName ?? "").toLowerCase().includes(q)
      )
    })
  }, [rows, searchQuery, statusFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">
              Brand/model autofills
            </h1>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
              {loading ? "Loading…" : `${summary.total} attached`}
            </span>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Listings the daily cron matched to a directory brand or catalog model from their
            title. Cross-verify each match and open the listing to double-check.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Sparkles} accent="neutral" label="Total attached" value={String(summary.total)} />
        <StatTile icon={Tag} accent="emerald" label="Brand attached" value={String(summary.brandAttached)} />
        <StatTile icon={Package} accent="sky" label="Model attached" value={String(summary.modelAttached)} />
        <StatTile
          icon={AlertTriangle}
          accent="amber"
          label="Changed since"
          value={String(summary.changedSince)}
          hint="Link edited or listing gone"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by title, brand, or model…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="sm:w-52">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All autofills</SelectItem>
              <SelectItem value="brand">Brand attached</SelectItem>
              <SelectItem value="model">Model attached</SelectItem>
              <SelectItem value="changed">Changed since attach</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!loading && filtered.length !== rows.length ? (
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            {filtered.length} match{filtered.length === 1 ? "" : "es"} of {rows.length}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="mt-3 font-medium text-foreground">No autofills yet</p>
            <p className="text-sm text-muted-foreground">
              {rows.length === 0
                ? "The cron hasn’t attached any brands or models yet."
                : "Try adjusting your search or filter."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Listing</TableHead>
                <TableHead>Attached brand</TableHead>
                <TableHead>Attached model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const href = listingDetailHref({
                  id: row.listingId,
                  slug: row.listingSlug,
                  section: row.listingSection,
                })
                const brandDrifted = row.attachedBrand && !row.brandStillLinked
                const modelDrifted = row.attachedModel && !row.modelStillLinked
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Link
                          href={href}
                          target="_blank"
                          className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border"
                        >
                          {row.primaryImageUrl ? (
                            <Image
                              src={proxiedListingImageSrc(row.primaryImageUrl) || "/placeholder.svg"}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-cover object-center"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </Link>
                        <div className="flex min-w-0 flex-col">
                          <Link
                            href={href}
                            target="_blank"
                            className="line-clamp-1 max-w-[260px] font-medium text-foreground hover:underline"
                          >
                            {capitalizeWords(row.listingTitle)}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {row.listingDeleted ? "Listing no longer exists" : `Section: ${row.listingSection}`}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      {row.attachedBrand ? (
                        <div className="flex flex-col gap-1">
                          <span className="line-clamp-1 text-sm font-medium text-foreground">
                            {row.brandName ?? "—"}
                          </span>
                          {brandDrifted ? (
                            <span className="inline-flex w-fit items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" />
                              now: {row.currentBrand ?? "cleared"}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      {row.attachedModel ? (
                        <div className="flex flex-col gap-1">
                          <span className="line-clamp-1 text-sm font-medium text-foreground">
                            {row.modelName ?? "—"}
                          </span>
                          {modelDrifted ? (
                            <span className="inline-flex w-fit items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" />
                              now: {row.currentModel ?? "cleared"}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.listingDeleted ? (
                        <Badge variant="outline" className="border-rose-500/30 text-rose-600 dark:text-rose-400">
                          Deleted
                        </Badge>
                      ) : brandDrifted || modelDrifted ? (
                        <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="mr-1 h-3 w-3" /> Changed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> In place
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">
                        {format(new Date(row.createdAt), "MMM d, yyyy")}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={href} target="_blank" aria-label="Open listing">
                          <ExternalLink className="h-4 w-4" />
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
    </div>
  )
}

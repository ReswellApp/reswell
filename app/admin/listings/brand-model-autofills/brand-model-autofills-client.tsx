"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { format, formatDistanceToNow } from "date-fns"
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Package,
  Pencil,
  Sparkles,
  Tag,
  Undo2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ListingBrandModelEditor,
  listingBrandModelEditorInitialFromAutofill,
  listingBrandModelEditorInitialFromUnmatched,
} from "./listing-brand-model-editor"

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
  currentBrandId: string | null
  currentBrandModelId: string | null
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

type SectionCoverage = {
  activeListings: number
  missingEither: number
  missingBrand: number
  missingModel: number
}

type Coverage = {
  surfboards: SectionCoverage
  fins: SectionCoverage
}

type UnmatchedRow = {
  listingId: string
  listingTitle: string
  listingSlug: string | null
  listingSection: string
  listingStatus: string | null
  primaryImageUrl: string | null
  needsBrand: boolean
  needsModel: boolean
  matchedBrandName: string | null
  matchedBrandId: string | null
  currentBrand: string | null
  currentModel: string | null
  currentBrandId: string | null
  currentBrandModelId: string | null
  brandKnownModelMissing: boolean
  firstSeenAt: string
  lastSeenAt: string
}

type UnmatchedSummary = {
  total: number
  needsBrand: number
  needsModel: number
  brandKnownModelMissing: number
}

type UnmatchedFilter = "all" | "brand" | "model" | "brandKnown"

type AutofillApiResponse = {
  data?: { rows?: AutofillRow[]; summary?: AutofillSummary; coverage?: Coverage }
  error?: string
}
type UnmatchedApiResponse = {
  data?: { rows?: UnmatchedRow[]; summary?: UnmatchedSummary }
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
  accent: "neutral" | "emerald" | "sky" | "amber" | "rose"
}) {
  const accentClass = {
    neutral: "bg-secondary text-foreground",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
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

function ListingThumb({ url, href }: { url: string | null; href: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border"
    >
      {url ? (
        <Image
          src={proxiedListingImageSrc(url) || "/placeholder.svg"}
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
  )
}

function TableSkeleton() {
  return (
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
  )
}

function CoverageSectionLine({
  label,
  data,
  maxPerSectionPerDay,
}: {
  label: string
  data: SectionCoverage
  maxPerSectionPerDay: number
}) {
  return (
    <p>
      <span className="font-medium text-foreground">{label}:</span>{" "}
      <span className="font-medium text-foreground tabular-nums">{data.missingEither}</span> of{" "}
      <span className="tabular-nums">{data.activeListings}</span> active listings still have no
      catalog link
      {data.missingEither > 0 ? (
        <>
          {" "}
          (<span className="tabular-nums">{data.missingBrand}</span> missing a brand,{" "}
          <span className="tabular-nums">{data.missingModel}</span> missing a model). The cron works
          through these oldest-first, up to{" "}
          <span className="tabular-nums">{maxPerSectionPerDay}</span> per section per day.
        </>
      ) : (
        <> — every listing is fully linked.</>
      )}
    </p>
  )
}

function decrementSectionCoverage(
  coverage: SectionCoverage,
  row: Pick<UnmatchedRow, "needsBrand" | "needsModel">,
): SectionCoverage {
  return {
    ...coverage,
    missingEither: Math.max(0, coverage.missingEither - 1),
    missingBrand: Math.max(0, coverage.missingBrand - (row.needsBrand ? 1 : 0)),
    missingModel: Math.max(0, coverage.missingModel - (row.needsModel ? 1 : 0)),
  }
}

function coverageSectionKey(section: string): keyof Coverage | null {
  if (section === "surfboards" || section === "fins") return section
  return null
}

export function BrandModelAutofillsAdminClient() {
  const [rows, setRows] = useState<AutofillRow[]>([])
  const [summary, setSummary] = useState<AutofillSummary>({
    total: 0,
    brandAttached: 0,
    modelAttached: 0,
    changedSince: 0,
  })
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [unmatched, setUnmatched] = useState<UnmatchedRow[]>([])
  const [unmatchedSummary, setUnmatchedSummary] = useState<UnmatchedSummary>({
    total: 0,
    needsBrand: 0,
    needsModel: 0,
    brandKnownModelMissing: 0,
  })
  const [unmatchedFilter, setUnmatchedFilter] = useState<UnmatchedFilter>("all")
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [undoingId, setUndoingId] = useState<string | null>(null)
  const [editingListingId, setEditingListingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [attachedRes, unmatchedRes] = await Promise.all([
        fetch("/api/admin/listings/brand-model-autofills", { credentials: "include" }),
        fetch("/api/admin/listings/brand-model-unmatched", { credentials: "include" }),
      ])
      const attachedJson = (await attachedRes.json().catch(() => ({}))) as AutofillApiResponse
      const unmatchedJson = (await unmatchedRes.json().catch(() => ({}))) as UnmatchedApiResponse

      if (!attachedRes.ok) {
        toast.error(attachedJson.error || "Could not load autofills")
        setRows([])
      } else {
        setRows(Array.isArray(attachedJson.data?.rows) ? attachedJson.data!.rows : [])
        if (attachedJson.data?.summary) setSummary(attachedJson.data.summary)
        if (attachedJson.data?.coverage) setCoverage(attachedJson.data.coverage)
      }

      if (!unmatchedRes.ok) {
        toast.error(unmatchedJson.error || "Could not load unmatched listings")
        setUnmatched([])
      } else {
        setUnmatched(Array.isArray(unmatchedJson.data?.rows) ? unmatchedJson.data!.rows : [])
        if (unmatchedJson.data?.summary) setUnmatchedSummary(unmatchedJson.data.summary)
      }
    } catch {
      toast.error("Could not load data")
      setRows([])
      setUnmatched([])
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

  const filteredUnmatched = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return unmatched.filter((row) => {
      if (unmatchedFilter === "brand" && !row.needsBrand) return false
      if (unmatchedFilter === "model" && !row.needsModel) return false
      if (unmatchedFilter === "brandKnown" && !row.brandKnownModelMissing) return false
      if (!q) return true
      return (
        row.listingTitle.toLowerCase().includes(q) ||
        (row.matchedBrandName ?? "").toLowerCase().includes(q)
      )
    })
  }, [unmatched, searchQuery, unmatchedFilter])

  async function handleUndo(row: AutofillRow) {
    const parts = [row.attachedBrand ? "brand" : null, row.attachedModel ? "model" : null].filter(
      Boolean,
    )
    if (
      !confirm(
        `Remove the auto-attached ${parts.join(" and ")} from “${capitalizeWords(
          row.listingTitle,
        )}”? This clears it from the listing.`,
      )
    ) {
      return
    }
    setUndoingId(row.id)
    try {
      const res = await fetch(
        `/api/admin/listings/brand-model-autofills/${encodeURIComponent(row.id)}/undo`,
        { method: "POST", credentials: "include" },
      )
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(json.error || "Could not undo")
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      setSummary((prev) => ({
        total: Math.max(0, prev.total - 1),
        brandAttached: Math.max(0, prev.brandAttached - (row.attachedBrand ? 1 : 0)),
        modelAttached: Math.max(0, prev.modelAttached - (row.attachedModel ? 1 : 0)),
        changedSince: prev.changedSince,
      }))
      toast.success("Auto-attached link removed")
    } catch {
      toast.error("Could not undo")
    } finally {
      setUndoingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">
            Brand/model autofills
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Listings the daily cron matched to a directory brand or catalog model from their
            title — and titles it couldn’t match, so you know which brands/models to add. Covers
            surfboards and fins (fin listings use fin-tagged catalog brands/models only).
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {coverage ? (
        <div className="space-y-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <CoverageSectionLine
            label="Surfboards"
            data={coverage.surfboards}
            maxPerSectionPerDay={250}
          />
          <CoverageSectionLine label="Fins" data={coverage.fins} maxPerSectionPerDay={250} />
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-3">
        <Input
          placeholder="Search by title, brand, or model…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Tabs defaultValue="attached" className="w-full">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="attached">
            Attached
            <span className="ml-1.5 tabular-nums text-muted-foreground">{summary.total}</span>
          </TabsTrigger>
          <TabsTrigger value="unmatched">
            No matches
            <span className="ml-1.5 tabular-nums text-muted-foreground">
              {unmatchedSummary.total}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* -------------------------------------------------------------- */}
        {/* Attached tab                                                   */}
        {/* -------------------------------------------------------------- */}
        <TabsContent value="attached" className="mt-6 space-y-4">
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

          <div className="flex items-center justify-end">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-52">
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

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {loading ? (
              <TableSkeleton />
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
                    <TableHead className="text-right">Actions</TableHead>
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
                    const isEditing = editingListingId === row.listingId
                    const canEditCatalog = !row.listingDeleted
                    return (
                      <Fragment key={row.id}>
                      <TableRow>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ListingThumb url={row.primaryImageUrl} href={href} />
                            <div className="flex min-w-0 flex-col">
                              <Link
                                href={href}
                                target="_blank"
                                className="line-clamp-1 max-w-[240px] font-medium text-foreground hover:underline"
                              >
                                {capitalizeWords(row.listingTitle)}
                              </Link>
                              <span className="text-xs text-muted-foreground">
                                {row.listingDeleted
                                  ? "Listing no longer exists"
                                  : `Section: ${row.listingSection}`}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[170px]">
                          {row.attachedBrand ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex w-fit items-center gap-1 line-clamp-1 text-sm font-medium text-foreground">
                                {row.brandName ?? "—"}
                                <Badge variant="outline" className="border-emerald-500/30 px-1 py-0 text-[10px] text-emerald-600 dark:text-emerald-400">
                                  added
                                </Badge>
                              </span>
                              {brandDrifted ? (
                                <span className="inline-flex w-fit items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  now: {row.currentBrand ?? "cleared"}
                                </span>
                              ) : null}
                            </div>
                          ) : row.currentBrand ? (
                            <div className="flex flex-col">
                              <span className="line-clamp-1 text-sm text-muted-foreground">
                                {row.currentBrand}
                              </span>
                              <span className="text-[11px] text-muted-foreground/70">already linked</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[170px]">
                          {row.attachedModel ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex w-fit items-center gap-1 line-clamp-1 text-sm font-medium text-foreground">
                                {row.modelName ?? "—"}
                                <Badge variant="outline" className="border-emerald-500/30 px-1 py-0 text-[10px] text-emerald-600 dark:text-emerald-400">
                                  added
                                </Badge>
                              </span>
                              {modelDrifted ? (
                                <span className="inline-flex w-fit items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  now: {row.currentModel ?? "cleared"}
                                </span>
                              ) : null}
                            </div>
                          ) : row.currentModel ? (
                            <div className="flex flex-col">
                              <span className="line-clamp-1 text-sm text-muted-foreground">
                                {row.currentModel}
                              </span>
                              <span className="text-[11px] text-muted-foreground/70">already linked</span>
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
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {canEditCatalog ? (
                              <Button
                                variant={isEditing ? "secondary" : "outline"}
                                size="sm"
                                onClick={() =>
                                  setEditingListingId(isEditing ? null : row.listingId)
                                }
                              >
                                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                {isEditing ? "Close" : "Edit"}
                              </Button>
                            ) : null}
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <Link href={href} target="_blank" aria-label="Open listing">
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={undoingId === row.id}
                              onClick={() => void handleUndo(row)}
                            >
                              {undoingId === row.id ? (
                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                              ) : (
                                <Undo2 className="mr-1.5 h-4 w-4" />
                              )}
                              Undo
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isEditing && canEditCatalog ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="bg-muted/20 py-4">
                            <ListingBrandModelEditor
                              listingId={row.listingId}
                              initial={listingBrandModelEditorInitialFromAutofill(row)}
                              onCancel={() => setEditingListingId(null)}
                              onSaved={() => {
                                setEditingListingId(null)
                                void load()
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* -------------------------------------------------------------- */}
        {/* Unmatched tab                                                  */}
        {/* -------------------------------------------------------------- */}
        <TabsContent value="unmatched" className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={AlertTriangle} accent="amber" label="No matches" value={String(unmatchedSummary.total)} />
            <StatTile icon={Tag} accent="rose" label="Missing brand" value={String(unmatchedSummary.needsBrand)} />
            <StatTile icon={Package} accent="rose" label="Missing model" value={String(unmatchedSummary.needsModel)} />
            <StatTile
              icon={Package}
              accent="sky"
              label="Brand known · add model"
              value={String(unmatchedSummary.brandKnownModelMissing)}
              hint="Just add the model to that brand"
            />
          </div>

          <div className="flex items-center justify-end">
            <Select
              value={unmatchedFilter}
              onValueChange={(v) => setUnmatchedFilter(v as UnmatchedFilter)}
            >
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All unmatched</SelectItem>
                <SelectItem value="brand">Missing brand</SelectItem>
                <SelectItem value="model">Missing model</SelectItem>
                <SelectItem value="brandKnown">Brand known · add model</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            These active listings have a title the cron couldn’t match to the catalog. Use{" "}
            <span className="font-medium text-foreground">Edit catalog</span> to link a directory
            brand and model directly on the listing, or add missing entries in the{" "}
            <Link href="/admin/used-board-market-dashboard?tab=catalog" className="text-primary underline-offset-2 hover:underline">
              brand catalog explorer
            </Link>{" "}
            for the cron to pick up on the next run.
          </p>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {loading ? (
              <TableSkeleton />
            ) : filteredUnmatched.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </span>
                <p className="mt-3 font-medium text-foreground">Nothing unmatched</p>
                <p className="text-sm text-muted-foreground">
                  {unmatched.length === 0
                    ? "Every processed listing matched a catalog brand/model."
                    : "Try adjusting your search."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Listing</TableHead>
                    <TableHead>Missing</TableHead>
                    <TableHead>Known brand</TableHead>
                    <TableHead>First seen</TableHead>
                    <TableHead>Last seen</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnmatched.map((row) => {
                    const href = listingDetailHref({
                      id: row.listingId,
                      slug: row.listingSlug,
                      section: row.listingSection,
                    })
                    const isEditing = editingListingId === row.listingId
                    return (
                      <Fragment key={row.listingId}>
                      <TableRow>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ListingThumb url={row.primaryImageUrl} href={href} />
                            <Link
                              href={href}
                              target="_blank"
                              className="line-clamp-2 max-w-[280px] font-medium text-foreground hover:underline"
                            >
                              {capitalizeWords(row.listingTitle)}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {row.needsBrand ? (
                              <Badge variant="outline" className="border-rose-500/30 text-rose-600 dark:text-rose-400">
                                <Tag className="mr-1 h-3 w-3" /> Brand
                              </Badge>
                            ) : null}
                            {row.needsModel ? (
                              <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
                                <Package className="mr-1 h-3 w-3" /> Model
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          {row.brandKnownModelMissing ? (
                            <div className="flex flex-col">
                              <span className="line-clamp-1 text-sm font-medium text-foreground">
                                {row.matchedBrandName}
                              </span>
                              <span className="text-[11px] text-sky-600 dark:text-sky-400">
                                add model to this brand
                              </span>
                            </div>
                          ) : (
                            <span className="line-clamp-1 text-sm text-muted-foreground">
                              {row.matchedBrandName ?? "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(row.firstSeenAt), { addSuffix: true })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(row.lastSeenAt), { addSuffix: true })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant={isEditing ? "secondary" : "outline"}
                              size="sm"
                              onClick={() =>
                                setEditingListingId(isEditing ? null : row.listingId)
                              }
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              {isEditing ? "Close" : "Edit catalog"}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <Link href={href} target="_blank" aria-label="Open listing">
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isEditing ? (
                        <TableRow key={`${row.listingId}-edit`} className="hover:bg-transparent">
                          <TableCell colSpan={6} className="bg-muted/20 py-4">
                            <ListingBrandModelEditor
                              listingId={row.listingId}
                              initial={listingBrandModelEditorInitialFromUnmatched(row)}
                              onCancel={() => setEditingListingId(null)}
                              onSaved={(data) => {
                                setEditingListingId(null)
                                setUnmatched((prev) => {
                                  const stillNeedsBrand = !data.brandId
                                  const stillNeedsModel = !data.brandModelId
                                  if (!stillNeedsBrand && !stillNeedsModel) {
                                    return prev.filter((r) => r.listingId !== row.listingId)
                                  }
                                  return prev.map((r) =>
                                    r.listingId === row.listingId
                                      ? {
                                          ...r,
                                          needsBrand: stillNeedsBrand,
                                          needsModel: stillNeedsModel,
                                          currentBrand: data.brand,
                                          currentModel: data.model,
                                          currentBrandId: data.brandId,
                                          currentBrandModelId: data.brandModelId,
                                          matchedBrandName: data.brand ?? r.matchedBrandName,
                                          matchedBrandId: data.brandId ?? r.matchedBrandId,
                                          brandKnownModelMissing:
                                            stillNeedsModel &&
                                            !stillNeedsBrand &&
                                            !!data.brand,
                                        }
                                      : r,
                                  )
                                })
                                setUnmatchedSummary((prev) => {
                                  const removed =
                                    data.brandId && data.brandModelId
                                  if (!removed) return prev
                                  const wasBrand = row.needsBrand
                                  const wasModel = row.needsModel
                                  const wasKnown = row.brandKnownModelMissing
                                  return {
                                    total: Math.max(0, prev.total - 1),
                                    needsBrand: Math.max(
                                      0,
                                      prev.needsBrand - (wasBrand ? 1 : 0),
                                    ),
                                    needsModel: Math.max(
                                      0,
                                      prev.needsModel - (wasModel ? 1 : 0),
                                    ),
                                    brandKnownModelMissing: Math.max(
                                      0,
                                      prev.brandKnownModelMissing - (wasKnown ? 1 : 0),
                                    ),
                                  }
                                })
                                if (data.brandId && data.brandModelId) {
                                  setCoverage((c) => {
                                    if (!c) return c
                                    const key = coverageSectionKey(row.listingSection)
                                    if (!key) return c
                                    return {
                                      ...c,
                                      [key]: decrementSectionCoverage(c[key], row),
                                    }
                                  })
                                }
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

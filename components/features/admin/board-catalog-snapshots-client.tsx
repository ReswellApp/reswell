"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { Check, ImagePlus, Loader2, MoreHorizontal, PlusCircle, Search, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"

import {
  BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES,
  BRAND_MODEL_VARIANT_DEFAULT_MATERIAL,
  type BrandModelVariantCondition,
  type BrandModelVariantMaterial,
  type FinBoxesType,
} from "@/lib/validations/brand-model-variants"
import { finBoxTypeFromListingFinsSetup } from "@/lib/utils/fins-setup-to-fin-box"
import {
  formatBoardType,
  formatCondition,
  isListingSellableCondition,
  listingConditionFilterRows,
  sellFormConditionValue,
} from "@/lib/listing-labels"
import { buildBoardCatalogDimensionLabelsFromListingRow } from "@/lib/utils/listing-board-catalog-snapshot"
import {
  FIN_BOXES_ADMIN_OPTIONS,
  VARIANT_MATERIAL_ADMIN_OPTIONS,
} from "@/lib/utils/brand-model-dimensions"

import type {
  UserListingBoardModelDataRow,
  UserListingBoardModelDataListingEmbed,
  UserListingBoardModelDataListingImageEmbed,
} from "@/lib/db/user-listing-board-model-data"
import { BrandEditorFormFields } from "@/components/brands/brand-editor-form-fields"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { slugifyBrandName } from "@/lib/brands/slug"
import { uploadBrandLogoFile } from "@/lib/brands/upload-brand-logo-client"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group"
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

export type SnapshotAdminRowApi = UserListingBoardModelDataRow & {
  listings?: UserListingBoardModelDataListingEmbed | null | undefined
  brands?: { name: string | null; slug: string | null } | null | undefined
}

type ApiListResponse =
  | {
      data: {
        rows: SnapshotAdminRowApi[]
        total: number
        limit: number
        offset: number
      }
    }
  | { error: string }

/** Client-only triage labels for this admin table — stored in `localStorage`, not the DB. */
type BoardCatalogSnapshotPriority = "high" | "medium" | "low"

const BOARD_CATALOG_SNAPSHOT_PRIORITY_STORAGE_KEY =
  "reswell:admin:board-catalog-snapshot-priorities"

/** Snapshot row ids hidden from this admin table (client-only; same browser). */
const BOARD_CATALOG_SNAPSHOT_DISMISSED_STORAGE_KEY =
  "reswell:admin:board-catalog-dismissed-row-ids"

const PRIORITY_LABEL: Record<BoardCatalogSnapshotPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

const CATALOG_SNAPSHOT_IMAGE_UPLOAD_MAX = 5 * 1024 * 1024

function sortedListingImagesForPicker(
  row: SnapshotAdminRowApi,
): UserListingBoardModelDataListingImageEmbed[] {
  const raw = row.listings?.listing_images
  if (!raw || !Array.isArray(raw)) return []
  const valid = raw.filter(
    (img): img is UserListingBoardModelDataListingImageEmbed =>
      typeof img === "object" &&
      img !== null &&
      typeof (img as UserListingBoardModelDataListingImageEmbed).id === "string" &&
      typeof (img as UserListingBoardModelDataListingImageEmbed).url === "string",
  )
  return [...valid].sort((a, b) => {
    const ap = a.is_primary ? 1 : 0
    const bp = b.is_primary ? 1 : 0
    if (ap !== bp) return bp - ap
    const ao = typeof a.sort_order === "number" && Number.isFinite(a.sort_order) ? a.sort_order : 0
    const bo = typeof b.sort_order === "number" && Number.isFinite(b.sort_order) ? b.sort_order : 0
    if (ao !== bo) return ao - bo
    return a.id.localeCompare(b.id)
  })
}

async function uploadSnapshotConvertModelHeroFile(file: File): Promise<string | null> {
  if (file.size > CATALOG_SNAPSHOT_IMAGE_UPLOAD_MAX) {
    toast.error("Image must be under 5MB")
    return null
  }
  const supabase = createClient()
  const ext = (file.name.split(".").pop() || "png").toLowerCase()
  const safeExt = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? ext : "png"
  const path = `board-models/${crypto.randomUUID()}.${safeExt}`
  const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: false })
  if (error) {
    console.error(error)
    toast.error(error.message || "Upload failed")
    return null
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from("brand-assets").getPublicUrl(path)
  return `${publicUrl}?t=${Date.now()}`
}

async function uploadSnapshotConvertVariantFile(file: File): Promise<string | null> {
  if (file.size > CATALOG_SNAPSHOT_IMAGE_UPLOAD_MAX) {
    toast.error("Image must be under 5MB")
    return null
  }
  const supabase = createClient()
  const ext = (file.name.split(".").pop() || "png").toLowerCase()
  const safeExt = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? ext : "png"
  const path = `board-models/dimensions/${crypto.randomUUID()}.${safeExt}`
  const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: false })
  if (error) {
    console.error(error)
    toast.error(error.message || "Upload failed")
    return null
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from("brand-assets").getPublicUrl(path)
  return `${publicUrl}?t=${Date.now()}`
}

function parseStoredPriorities(raw: string): Record<string, BoardCatalogSnapshotPriority> {
  try {
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== "object" || Array.isArray(data)) return {}
    const out: Record<string, BoardCatalogSnapshotPriority> = {}
    for (const [id, v] of Object.entries(data as Record<string, unknown>)) {
      if (typeof id !== "string" || id.length === 0) continue
      if (v === "high" || v === "medium" || v === "low") out[id] = v
    }
    return out
  } catch {
    return {}
  }
}

function loadBoardCatalogSnapshotPriorities(): Record<string, BoardCatalogSnapshotPriority> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(BOARD_CATALOG_SNAPSHOT_PRIORITY_STORAGE_KEY)
    return raw ? parseStoredPriorities(raw) : {}
  } catch {
    return {}
  }
}

function loadDismissedRowIds(): Record<string, true> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(BOARD_CATALOG_SNAPSHOT_DISMISSED_STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return {}
    const out: Record<string, true> = {}
    for (const id of data) {
      if (typeof id === "string" && id.length > 0) out[id] = true
    }
    return out
  } catch {
    return {}
  }
}

function snapshotPriorityBadgeClass(p: BoardCatalogSnapshotPriority): string {
  switch (p) {
    case "high":
      return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
    case "low":
      return "border-border bg-muted/60 text-muted-foreground"
    default:
      return ""
  }
}

function SnapshotRowActionsDropdown({
  rowId,
  priority,
  onSetPriority,
  onClearPriority,
  onRequestRemoveFromTable,
}: {
  rowId: string
  priority: BoardCatalogSnapshotPriority | undefined
  onSetPriority: (id: string, p: BoardCatalogSnapshotPriority) => void
  onClearPriority: (id: string) => void
  onRequestRemoveFromTable: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Row actions"
          title={priority ? `Priority: ${PRIORITY_LABEL[priority]}` : "Row actions"}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {(["high", "medium", "low"] as const).map((p) => (
          <DropdownMenuItem key={p} onClick={() => onSetPriority(rowId, p)} className="justify-between gap-2">
            <span>{PRIORITY_LABEL[p]}</span>
            {priority === p ? <Check className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onClearPriority(rowId)}
          disabled={priority == null}
          className="text-muted-foreground"
        >
          Clear priority
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            onRequestRemoveFromTable()
          }}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          Delete from table
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function listingHref(slug: string | null | undefined): string {
  const s = slug?.trim()
  return s ? `/l/${encodeURIComponent(s)}` : ""
}

function coalesceSnapshotThenListing(
  snapshot: string | null | undefined,
  fromListing: string | undefined,
): string {
  const a = (snapshot ?? "").trim()
  if (a) return a
  return (fromListing ?? "").trim()
}

/**
 * Snapshot row (`user_listing_board_model_data`) may carry labels from publish time; the joined `listings`
 * row may carry fresher numeric/display dims. Merge per field — snapshot wins when set so admins keep
 * intentional snapshot edits, otherwise listing-derived labels fill gaps (fixes missing width/vol when
 * length existed only on the snapshot).
 */
function mergedBoardCatalogDimensionLabelsForSnapshotRow(row: SnapshotAdminRowApi): {
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
} {
  const lg = row.listings ?? undefined
  const fromListing =
    lg != null ? buildBoardCatalogDimensionLabelsFromListingRow({ dimensions: lg.dimensions ?? null }) : null

  return {
    length_label: coalesceSnapshotThenListing(row.length_label, fromListing?.length_label),
    width_label: coalesceSnapshotThenListing(row.width_label, fromListing?.width_label),
    thickness_label: coalesceSnapshotThenListing(row.thickness_label, fromListing?.thickness_label),
    volume_label: coalesceSnapshotThenListing(row.volume_label, fromListing?.volume_label),
  }
}

function dimensionsSummaryFromMergedLabels(m: {
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
}): string {
  const pieces = [m.length_label, m.width_label, m.thickness_label].map((s) => s.trim()).filter(Boolean)
  const mid = pieces.join(" × ")
  const vol = m.volume_label.trim()
  const out = vol ? `${mid}${mid ? " — " : ""}${vol}` : mid
  return out.trim()
}

/** Prefer live listing dims; otherwise snapshot dimension labels still on `user_listing_board_model_data`. */
function dimsSummaryFromSnapshotRow(r: SnapshotAdminRowApi): string {
  const m = mergedBoardCatalogDimensionLabelsForSnapshotRow(r)
  const s = dimensionsSummaryFromMergedLabels(m)
  return s.trim() || "—"
}

function listingPriceAsNumber(
  listing: UserListingBoardModelDataListingEmbed | null | undefined,
): number | null {
  if (!listing || listing.price == null) return null
  const p = listing.price
  if (typeof p === "number" && Number.isFinite(p) && p >= 0) return p
  if (typeof p === "string") {
    const n = Number.parseFloat(p.replace(/,/g, ""))
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  return null
}

function listingUpdatedLabel(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—"
  try {
    return format(new Date(iso.trim()), "MMM d yyyy")
  } catch {
    return "—"
  }
}

/** Lowercase haystack for client-side listing search on this admin page. */
function boardCatalogSnapshotSearchHaystack(r: SnapshotAdminRowApi): string {
  const parts: string[] = []
  const lg = r.listings
  if (lg?.title?.trim()) parts.push(lg.title.trim())
  if (lg?.slug?.trim()) parts.push(lg.slug.trim())
  if (lg?.brand?.trim()) parts.push(lg.brand.trim())
  if (lg?.board_type?.trim()) parts.push(lg.board_type.trim())
  if (lg?.condition?.trim()) parts.push(lg.condition.trim())
  if (lg?.description?.trim()) parts.push(lg.description.trim().slice(0, 4000))
  if (r.brands?.name?.trim()) parts.push(r.brands.name.trim())
  const brandSlug = r.brands?.slug?.trim()
  if (brandSlug) parts.push(brandSlug)
  if (r.model_name?.trim()) parts.push(r.model_name.trim())
  if (r.catalog_brand_slug?.trim()) parts.push(r.catalog_brand_slug.trim())
  if (r.catalog_model_slug?.trim()) parts.push(r.catalog_model_slug.trim())
  parts.push(dimsSummaryFromSnapshotRow(r))
  parts.push(String(r.listing_price))
  if (r.sold_price != null && Number.isFinite(Number(r.sold_price))) parts.push(String(r.sold_price))
  return parts.join(" ").toLowerCase()
}

function snapshotRowMatchesSearch(r: SnapshotAdminRowApi, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  const hay = boardCatalogSnapshotSearchHaystack(r)
  const tokens = q.split(/\s+/).filter(Boolean)
  return tokens.every((tok) => hay.includes(tok))
}

export function BoardCatalogSnapshotsClient() {
  const [pendingOnly, setPendingOnly] = useState(true)
  const [rows, setRows] = useState<SnapshotAdminRowApi[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const [priorityFilter, setPriorityFilter] = useState<
    "all" | BoardCatalogSnapshotPriority
  >("all")
  const [priorities, setPriorities] = useState<
    Record<string, BoardCatalogSnapshotPriority>
  >({})
  const [dismissedRowIds, setDismissedRowIds] = useState<Record<string, true>>({})
  const [tablePrefsHydrated, setTablePrefsHydrated] = useState(false)
  const [dismissConfirmId, setDismissConfirmId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    setPriorities(loadBoardCatalogSnapshotPriorities())
    setDismissedRowIds(loadDismissedRowIds())
    setTablePrefsHydrated(true)
  }, [])

  useEffect(() => {
    if (!tablePrefsHydrated || typeof window === "undefined") return
    try {
      window.localStorage.setItem(
        BOARD_CATALOG_SNAPSHOT_PRIORITY_STORAGE_KEY,
        JSON.stringify(priorities),
      )
      window.localStorage.setItem(
        BOARD_CATALOG_SNAPSHOT_DISMISSED_STORAGE_KEY,
        JSON.stringify(Object.keys(dismissedRowIds)),
      )
    } catch {
      /* ignore quota */
    }
  }, [priorities, dismissedRowIds, tablePrefsHydrated])

  const setRowPriority = useCallback((id: string, p: BoardCatalogSnapshotPriority) => {
    setPriorities((prev) => ({ ...prev, [id]: p }))
  }, [])

  const clearRowPriority = useCallback((id: string) => {
    setPriorities((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const restoreDismissedRows = useCallback(() => {
    setDismissedRowIds({})
    toast.success("Hidden rows are visible again")
  }, [])

  const visibleRows = useMemo(
    () => rows.filter((r) => !dismissedRowIds[r.id]),
    [rows, dismissedRowIds],
  )

  const priorityFilteredRows = useMemo(() => {
    if (priorityFilter === "all") return visibleRows
    return visibleRows.filter((r) => priorities[r.id] === priorityFilter)
  }, [visibleRows, priorities, priorityFilter])

  const displayRows = useMemo(
    () => priorityFilteredRows.filter((r) => snapshotRowMatchesSearch(r, searchQuery)),
    [priorityFilteredRows, searchQuery],
  )

  const confirmRemoveRowFromTable = useCallback(() => {
    if (!dismissConfirmId) return
    const id = dismissConfirmId
    setDismissedRowIds((prev) => ({ ...prev, [id]: true }))
    setPriorities((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setDismissConfirmId(null)
    toast.success("Removed from table")
  }, [dismissConfirmId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      sp.set("pending_only", pendingOnly ? "true" : "false")
      sp.set("limit", "100")
      sp.set("offset", "0")
      const res = await fetch(`/api/admin/user-listing-board-model-data?${sp}`, {
        credentials: "include",
      })
      const data = (await res.json().catch(() => ({}))) as ApiListResponse
      if (!res.ok || !("data" in data)) {
        toast.error(("error" in data && typeof data.error === "string") ? data.error : "Could not load")
        setRows([])
        setTotal(0)
        return
      }
      setRows(Array.isArray(data.data.rows) ? data.data.rows : [])
      setTotal(Number(data.data.total) || 0)
    } finally {
      setLoading(false)
    }
  }, [pendingOnly])

  useEffect(() => {
    void load()
  }, [load])

  const hiddenDismissCount = rows.length - visibleRows.length

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl space-y-1">
          <h1 className="text-2xl font-bold text-foreground">User Listings Board Data</h1>
          <p className="text-muted-foreground text-sm">
            Aggregated surfboard listing fields from sellers ({total} matching). Use{" "}
            <span className="font-medium text-foreground">Convert</span> to add a normalized row under{" "}
            <Link href={`${BRANDS_BASE}`} className="text-primary underline-offset-2 hover:underline">
              brand models → variants
            </Link>
            . Rows without a linked catalog brand can use{" "}
            <span className="font-medium text-foreground">Attach brand</span> first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={pendingOnly ? "secondary" : "outline"}
            onClick={() => setPendingOnly(!pendingOnly)}
          >
            {pendingOnly ? "Showing not converted only" : "Showing all snapshots"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/listings">Back</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {!loading && rows.length > 0 ? (
        <div className="border-border bg-muted/20 flex flex-col gap-3 rounded-lg border px-3 py-2.5 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex min-w-[min(100%,18rem)] flex-1 flex-col gap-1.5">
            <Label
              htmlFor="board-catalog-search"
              className="text-muted-foreground text-xs font-medium uppercase tracking-wide"
            >
              Search
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="board-catalog-search"
                type="search"
                autoComplete="off"
                placeholder="Title, brand, model, dims, slug…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pr-9 pl-9"
              />
              {searchQuery.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:border-border lg:border-l lg:pl-4">
            <span className="text-muted-foreground shrink-0 text-xs font-medium uppercase tracking-wide">
              Priority filter
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={priorityFilter === "all" ? "secondary" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setPriorityFilter("all")}
              >
                All
              </Button>
              {(["high", "medium", "low"] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={priorityFilter === p ? "secondary" : "outline"}
                  size="sm"
                  className={cn("h-8", priorityFilter === p && snapshotPriorityBadgeClass(p))}
                  onClick={() => setPriorityFilter(p)}
                >
                  {PRIORITY_LABEL[p]}
                </Button>
              ))}
            </div>
          </div>
          <span className="text-muted-foreground lg:ml-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
            <span>
              Showing {displayRows.length} of {priorityFilteredRows.length}
              {hiddenDismissCount > 0 ? (
                <span className="text-muted-foreground/90"> ({hiddenDismissCount} hidden)</span>
              ) : null}
            </span>
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No rows yet.</p>
      ) : visibleRows.length === 0 ? (
        <div className="border-border bg-muted/15 space-y-3 rounded-lg border px-4 py-4">
          <p className="text-muted-foreground text-sm">
            Every snapshot row is hidden from this view. Rows you remove stay hidden until you restore them (stored in
            this browser only).
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => restoreDismissedRows()}>
            Show hidden rows
          </Button>
        </div>
      ) : priorityFilteredRows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No snapshots match this priority
          {priorityFilter !== "all" ? ` (${PRIORITY_LABEL[priorityFilter]})` : ""}. Choose{" "}
          <button
            type="button"
            className="text-primary font-medium underline-offset-2 hover:underline"
            onClick={() => setPriorityFilter("all")}
          >
            All
          </button>{" "}
          to see every row.
        </p>
      ) : displayRows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No listings match your search
          {searchQuery.trim() ? (
            <>
              {" "}
              (<span className="font-mono text-xs">{searchQuery.trim()}</span>)
            </>
          ) : null}
          .{" "}
          <button
            type="button"
            className="text-primary font-medium underline-offset-2 hover:underline"
            onClick={() => setSearchQuery("")}
          >
            Clear search
          </button>
          {" "}
          or adjust keywords.
        </p>
      ) : (
        <div className="bg-card border-border w-full min-w-0 max-w-full rounded-lg border shadow-sm">
          <Table className="w-full max-w-full table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[12%] whitespace-nowrap px-2 py-2 text-left text-xs font-semibold">
                  Listing upd.
                </TableHead>
                <TableHead className="w-[20%] px-2 py-2 text-xs font-semibold">Listing</TableHead>
                <TableHead className="w-[11%] px-2 py-2 text-xs font-semibold">Brand</TableHead>
                <TableHead className="w-[12%] px-2 py-2 text-xs font-semibold" title="Model label">
                  Model
                </TableHead>
                <TableHead className="w-[10%] px-2 py-2 text-xs font-semibold" title="Dimensions">
                  Dims
                </TableHead>
                <TableHead className="w-[7%] px-2 py-2 text-xs font-semibold">Price</TableHead>
                <TableHead className="w-[7%] px-2 py-2 text-xs font-semibold">Sold</TableHead>
                <TableHead className="w-[7%] px-2 py-2 text-xs font-semibold">Status</TableHead>
                <TableHead className="w-[14%] px-2 py-2 text-right text-xs font-semibold">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((r) => {
                const rowPriority = priorities[r.id]
                return (
                <TableRow key={r.id} className="align-top">
                  <TableCell className="w-[12%] overflow-hidden px-2 py-2 align-top text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                    {listingUpdatedLabel(r.listings?.updated_at)}
                  </TableCell>
                  <TableCell className="max-w-0 px-2 py-2 align-top">
                    {(() => {
                      const lg = r.listings
                      const slug = lg && typeof lg.slug === "string" ? lg.slug : null
                      const title = lg && typeof lg.title === "string" ? lg.title : "Listing"
                      const href = listingHref(slug)
                      return href ? (
                        <Link
                          href={href}
                          className="text-primary block max-w-full truncate text-sm font-medium leading-snug hover:underline"
                          title={title}
                        >
                          {title}
                        </Link>
                      ) : (
                        <span
                          className="block max-w-full truncate text-sm font-medium leading-snug"
                          title={title}
                        >
                          {title}
                        </span>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="max-w-0 px-2 py-2 align-top text-sm">
                    {(() => {
                      const b = r.brands?.name?.trim()
                      const slug = r.brands?.slug?.trim()
                      const label = r.brand_id ? b ?? "Brand ID set" : "—"
                      return slug ? (
                        <Link
                          href={`${BRANDS_BASE}/${encodeURIComponent(slug)}`}
                          className="block max-w-full truncate hover:underline"
                          title={label}
                        >
                          {label}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground block max-w-full truncate" title={label}>
                          {label}
                        </span>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="max-w-0 px-2 py-2 align-top text-sm leading-snug">
                    {(() => {
                      const label = r.model_name?.trim()
                      const bt = r.listings?.board_type?.trim()
                      return (
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-medium" title={label || undefined}>
                            {label || "—"}
                          </span>
                          {bt ? (
                            <span
                              className="text-muted-foreground truncate text-[11px]"
                              title={`${formatBoardType(bt)}${!label ? " · no index label" : ""}`}
                            >
                              {formatBoardType(bt)}
                              {!label ? " · no label" : ""}
                            </span>
                          ) : !label ? (
                            <span
                              className="text-muted-foreground truncate text-[11px]"
                              title="No model index on listing — use Convert to add catalog model"
                            >
                              No index label
                            </span>
                          ) : null}
                        </div>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="max-w-0 px-2 py-2 align-top text-xs leading-snug text-muted-foreground">
                    <span
                      className="line-clamp-2 break-words [overflow-wrap:anywhere]"
                      title={dimsSummaryFromSnapshotRow(r)}
                    >
                      {dimsSummaryFromSnapshotRow(r)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-0 px-2 py-2 align-top text-sm tabular-nums whitespace-nowrap">
                    ${r.listing_price.toFixed(2)}
                  </TableCell>
                  <TableCell className="max-w-0 px-2 py-2 align-top text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                    {r.sold_price != null ? `$${Number(r.sold_price).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="max-w-0 px-2 py-2 align-top text-xs whitespace-nowrap">
                    {r.converted_brand_model_variant_id ? (
                      <span className="text-emerald-600">Converted</span>
                    ) : (
                      <span className="text-muted-foreground">Open</span>
                    )}
                  </TableCell>
                  <TableCell className="w-[14%] px-2 py-2 align-top">
                    <div className="flex w-full min-w-0 flex-col items-stretch gap-1.5">
                      <div className="flex items-start justify-end gap-1.5">
                        {rowPriority ? (
                          <span
                            className={cn(
                              "inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] leading-none font-semibold uppercase tracking-wide",
                              snapshotPriorityBadgeClass(rowPriority),
                            )}
                          >
                            {PRIORITY_LABEL[rowPriority]}
                          </span>
                        ) : (
                          <span className="text-muted-foreground shrink-0 text-[10px] uppercase tracking-wide">
                            —
                          </span>
                        )}
                        <SnapshotRowActionsDropdown
                          rowId={r.id}
                          priority={rowPriority}
                          onSetPriority={setRowPriority}
                          onClearPriority={clearRowPriority}
                          onRequestRemoveFromTable={() => setDismissConfirmId(r.id)}
                        />
                      </div>
                      {!r.brand_id?.trim() && !r.converted_brand_model_variant_id && (
                        <AttachCatalogBrandDialog row={r} onAttached={() => void load()} />
                      )}
                      <ConvertCatalogSnapshotDialog
                        row={r}
                        disabled={Boolean(r.converted_brand_model_variant_id)}
                        onConverted={() => void load()}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        open={dismissConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setDismissConfirmId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from table?</AlertDialogTitle>
            <AlertDialogDescription>
              This hides the row in this admin table on this browser only. It does not delete the listing or catalog
              snapshot in Reswell. Use &quot;Show hidden rows&quot; to bring dismissed rows back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={() => confirmRemoveRowFromTable()}
            >
              Remove from table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

type CatalogBrandPickerRow = { id: string; name: string; slug: string }

function AttachCatalogBrandDialog({
  row,
  onAttached,
}: {
  row: SnapshotAdminRowApi
  onAttached: () => void
}) {
  const [open, setOpen] = useState(false)
  const [attachMode, setAttachMode] = useState<"existing" | "create">("existing")
  const [brands, setBrands] = useState<CatalogBrandPickerRow[]>([])
  const [loadingBrands, setLoadingBrands] = useState(false)
  const [pickBrandId, setPickBrandId] = useState("")
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newBrandName, setNewBrandName] = useState("")
  const [newBrandSlug, setNewBrandSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [newBrandShortDescription, setNewBrandShortDescription] = useState("")
  const [newBrandWebsiteUrl, setNewBrandWebsiteUrl] = useState("")
  const [newBrandLogoUrl, setNewBrandLogoUrl] = useState("")
  const [newBrandFounderName, setNewBrandFounderName] = useState("")
  const [newBrandLeadShaperName, setNewBrandLeadShaperName] = useState("")
  const [newBrandLocationLabel, setNewBrandLocationLabel] = useState("")
  const [newBrandModelCount, setNewBrandModelCount] = useState("0")
  const logoFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    async function loadBrands() {
      setLoadingBrands(true)
      try {
        const res = await fetch("/api/admin/brands", { credentials: "include" })
        const j = (await res.json()) as {
          data?: { rows?: CatalogBrandPickerRow[] }
          error?: string
        }
        if (!res.ok || !Array.isArray(j.data?.rows)) {
          toast.error(typeof j.error === "string" ? j.error : "Could not load brands")
          if (!cancelled) setBrands([])
          return
        }
        if (!cancelled) setBrands(j.data.rows)
      } catch {
        if (!cancelled) setBrands([])
        toast.error("Could not load brands")
      } finally {
        if (!cancelled) setLoadingBrands(false)
      }
    }
    void loadBrands()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setPickBrandId("")
    setAttachMode("existing")
    setSlugTouched(false)
    const hint =
      row.listings?.brand?.trim() ||
      row.brands?.name?.trim() ||
      ""
    setNewBrandName(hint)
    setNewBrandSlug(hint ? slugifyBrandName(hint) : "")
    setNewBrandShortDescription("")
    setNewBrandWebsiteUrl("")
    setNewBrandLogoUrl("")
    setNewBrandFounderName("")
    setNewBrandLeadShaperName("")
    setNewBrandLocationLabel("")
    setNewBrandModelCount("0")
    if (logoFileInputRef.current) logoFileInputRef.current.value = ""
  }, [open, row.id, row.listings?.brand, row.brands?.name])

  useEffect(() => {
    if (!open || attachMode !== "create" || slugTouched) return
    setNewBrandSlug(slugifyBrandName(newBrandName))
  }, [open, attachMode, slugTouched, newBrandName])

  async function attachById(brandId: string) {
    const res = await fetch(
      `/api/admin/user-listing-board-model-data/${encodeURIComponent(row.id)}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId.trim() }),
      },
    )
    const j = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      data?: { brand?: { name: string } }
    }
    if (!res.ok || !j.ok) {
      toast.error(typeof j.error === "string" ? j.error : "Could not attach brand")
      return false
    }
    toast.success(
      j.data?.brand?.name ? `Attached catalog brand: ${j.data.brand.name}` : "Catalog brand attached",
    )
    setOpen(false)
    onAttached()
    return true
  }

  async function saveExisting() {
    if (!pickBrandId.trim()) {
      toast.error("Select a catalog brand")
      return
    }
    setSaving(true)
    try {
      await attachById(pickBrandId.trim())
    } finally {
      setSaving(false)
    }
  }

  async function saveCreate() {
    const name = newBrandName.trim()
    const slug = newBrandSlug.trim()
    if (!name) {
      toast.error("Brand name is required")
      return
    }
    if (!slug) {
      toast.error("URL slug is required")
      return
    }
    setCreating(true)
    try {
      const file = logoFileInputRef.current?.files?.[0]
      let finalLogoUrl = newBrandLogoUrl.trim() || null
      if (file) {
        const uploaded = await uploadBrandLogoFile(file)
        if (!uploaded) {
          return
        }
        finalLogoUrl = uploaded
      }

      const mc = Math.max(0, Math.floor(Number(newBrandModelCount) || 0))

      const res = await fetch("/api/admin/brands", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name,
          short_description: newBrandShortDescription.trim() || null,
          website_url: newBrandWebsiteUrl.trim() || null,
          logo_url: finalLogoUrl,
          founder_name: newBrandFounderName.trim() || null,
          lead_shaper_name: newBrandLeadShaperName.trim() || null,
          location_label: newBrandLocationLabel.trim() || null,
          model_count: mc,
          about_paragraphs: [],
        }),
      })
      const j = (await res.json().catch(() => ({}))) as {
        id?: string
        slug?: string
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Could not create brand")
        return
      }
      const newId = typeof j.id === "string" ? j.id : ""
      if (!newId) {
        toast.error("Brand was created but did not return an id — refresh and pick it from the list")
        return
      }
      toast.success("Brand created — attaching…")
      await attachById(newId)
    } finally {
      setCreating(false)
    }
  }

  const primaryDisabled =
    saving ||
    creating ||
    (attachMode === "existing" &&
      (loadingBrands || brands.length === 0 || !pickBrandId.trim())) ||
    (attachMode === "create" && (!newBrandName.trim() || !newBrandSlug.trim()))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-auto w-full whitespace-normal px-2 py-1.5 text-xs leading-snug">
          Attach brand
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,880px)] gap-4 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach catalog brand</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Links this snapshot and its listing to a brand in{" "}
          <Link href={BRANDS_BASE} className="text-primary underline-offset-2 hover:underline">
            the catalog
          </Link>{" "}
          so you can convert it to a model variant.
        </p>

        <div className="space-y-2">
          <Label>Source</Label>
          <RadioGroup
            value={attachMode}
            onValueChange={(v) => {
              const m = v as "existing" | "create"
              setAttachMode(m)
              if (m === "create") {
                setSlugTouched(false)
              }
            }}
            className="gap-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existing" id="attach-brand-existing" />
              <Label htmlFor="attach-brand-existing" className="font-normal">
                Link to existing brand
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="create" id="attach-brand-create" />
              <Label htmlFor="attach-brand-create" className="inline-flex items-center gap-1.5 font-normal">
                <PlusCircle className="text-muted-foreground h-4 w-4" />
                Create new brand and attach
              </Label>
            </div>
          </RadioGroup>
        </div>

        {attachMode === "existing" ? (
          <>
            {loadingBrands ? (
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                Loading brands…
              </p>
            ) : brands.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No brands in the directory yet. Switch to{" "}
                <span className="text-foreground font-medium">Create new brand</span> above.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Catalog brand</Label>
                <Select value={pickBrandId} onValueChange={setPickBrandId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose brand…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        ) : (
          <BrandEditorFormFields
            idPrefix="attach-catalog-brand"
            slug={newBrandSlug}
            onSlugChange={(v) => {
              setSlugTouched(true)
              setNewBrandSlug(v)
            }}
            name={newBrandName}
            onNameChange={setNewBrandName}
            shortDescription={newBrandShortDescription}
            onShortDescriptionChange={setNewBrandShortDescription}
            websiteUrl={newBrandWebsiteUrl}
            onWebsiteUrlChange={setNewBrandWebsiteUrl}
            logoUrl={newBrandLogoUrl}
            onLogoUrlChange={setNewBrandLogoUrl}
            logoFileInputRef={logoFileInputRef}
            founderName={newBrandFounderName}
            onFounderNameChange={setNewBrandFounderName}
            leadShaperName={newBrandLeadShaperName}
            onLeadShaperNameChange={setNewBrandLeadShaperName}
            locationLabel={newBrandLocationLabel}
            onLocationLabelChange={setNewBrandLocationLabel}
            modelCount={newBrandModelCount}
            onModelCountChange={setNewBrandModelCount}
            slugExtraHint="Filled automatically from the name until you edit the slug."
          />
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void (attachMode === "existing" ? saveExisting() : saveCreate())}
            disabled={primaryDisabled}
          >
            {saving || creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {creating ? "Creating…" : "Saving…"}
              </>
            ) : attachMode === "create" ? (
              "Create & attach"
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type BrandModelItem = { id: string; name: string }

export function ConvertCatalogSnapshotDialog({
  row,
  disabled,
  onConverted,
}: {
  row: SnapshotAdminRowApi
  disabled?: boolean
  onConverted: () => void
}) {
  const brandId = row.brand_id?.trim() ?? ""
  const brandSlugForModels = row.brands?.slug?.trim()
  const listingBoardTypeLabel = formatBoardType(row.listings?.board_type)
  const snapshotModelLabel = row.model_name?.trim() ?? ""

  const [open, setOpen] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [brandModels, setBrandModels] = useState<BrandModelItem[]>([])
  const [mode, setMode] = useState<"existing_model" | "new_model">("existing_model")

  const [brandModelId, setBrandModelId] = useState("")
  const [newModelName, setNewModelName] = useState("")
  const [newModelDescription, setNewModelDescription] = useState("")
  const [lengthLabel, setLengthLabel] = useState("")
  const [widthLabel, setWidthLabel] = useState("")
  const [thicknessLabel, setThicknessLabel] = useState("")
  const [volumeLabel, setVolumeLabel] = useState("")
  const [finBox, setFinBox] = useState<"futures" | "fcs" | "single_fin">(() =>
    finBoxTypeFromListingFinsSetup(row.listings?.fins_setup ?? null),
  )
  const [finBoxesLayout, setFinBoxesLayout] = useState<FinBoxesType>(
    BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES,
  )
  const [variantMaterial, setVariantMaterial] = useState<BrandModelVariantMaterial>(
    BRAND_MODEL_VARIANT_DEFAULT_MATERIAL,
  )
  const [condition, setCondition] = useState<BrandModelVariantCondition>(
    row.condition as BrandModelVariantCondition,
  )
  const [catalogPrice, setCatalogPrice] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const newModelImageInputRef = useRef<HTMLInputElement>(null)
  const variantImageInputRef = useRef<HTMLInputElement>(null)
  const [newModelImageUrl, setNewModelImageUrl] = useState<string | null>(null)
  const [variantImageUrl, setVariantImageUrl] = useState<string | null>(null)
  const [newModelImageUploading, setNewModelImageUploading] = useState(false)
  const [variantImageUploading, setVariantImageUploading] = useState(false)

  const listingPickerImages = useMemo(() => sortedListingImagesForPicker(row), [row])

  useEffect(() => {
    if (!open || !brandId) return
    setBrandModels([])

    let cancelled = false
    async function fetchModels() {
      setLoadingModels(true)
      try {
        const res = await fetch(
          `/api/admin/brand-models?brand_id=${encodeURIComponent(brandId)}`,
          { credentials: "include" },
        )
        const j = (await res.json()) as {
          data?: { rows?: unknown[] }
          error?: string
        }
        const raw = Array.isArray(j.data?.rows) ? j.data!.rows! : []
        const list: BrandModelItem[] = raw
          .map((r) => {
            if (typeof r !== "object" || r === null) return null
            const rec = r as { id?: unknown; name?: unknown }
            if (typeof rec.id !== "string" || typeof rec.name !== "string") return null
            return { id: rec.id, name: rec.name }
          })
          .filter((x): x is BrandModelItem => x !== null)
        if (!cancelled) setBrandModels(list)
      } catch {
        if (!cancelled) setBrandModels([])
      } finally {
        if (!cancelled) setLoadingModels(false)
      }
    }
    void fetchModels()
    return () => {
      cancelled = true
    }
  }, [open, brandId])

  useEffect(() => {
    if (!open) return
    const lg = row.listings ?? undefined
    const dims = mergedBoardCatalogDimensionLabelsForSnapshotRow(row)
    setLengthLabel(dims.length_label)
    setWidthLabel(dims.width_label)
    setThicknessLabel(dims.thickness_label)
    setVolumeLabel(dims.volume_label)
    const finsRaw = lg?.fins_setup?.trim() || null
    setFinBox(finBoxTypeFromListingFinsSetup(finsRaw))
    setFinBoxesLayout(BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES)
    setVariantMaterial(BRAND_MODEL_VARIANT_DEFAULT_MATERIAL)

    let nextCondition = row.condition as BrandModelVariantCondition
    if (lg?.condition?.trim()) {
      const normalized = sellFormConditionValue(lg.condition)
      if (isListingSellableCondition(normalized)) {
        nextCondition = normalized
      }
    }
    setCondition(nextCondition)

    const livePrice = listingPriceAsNumber(lg)
    const fallbackSnapPrice =
      row.listing_price != null && Number.isFinite(row.listing_price) ? row.listing_price : null
    const priceToShow = livePrice ?? fallbackSnapPrice
    setCatalogPrice(priceToShow != null && priceToShow >= 0 ? String(priceToShow) : "")

    setBrandModelId("")
    const snapModel = row.model_name?.trim() ?? ""
    const titleHint =
      !snapModel && lg?.title?.trim() ? lg.title.trim().slice(0, 200) : ""
    setNewModelName(snapModel || titleHint)

    const desc = lg?.description?.trim() ?? ""
    setNewModelDescription(desc.length > 8000 ? desc.slice(0, 8000) : desc)

    setNewModelImageUrl(null)
    setNewModelImageUploading(false)
    setVariantImageUploading(false)
    if (newModelImageInputRef.current) newModelImageInputRef.current.value = ""
    if (variantImageInputRef.current) variantImageInputRef.current.value = ""

    const picks = sortedListingImagesForPicker(row)
    const defaultVariantUrl =
      picks.find((i) => i.is_primary)?.url ?? picks[0]?.url ?? null
    setVariantImageUrl(defaultVariantUrl)

    setMode("existing_model")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when opening snapshot
  }, [open, row])

  useEffect(() => {
    if (!open || loadingModels || !brandId) return
    if (brandModels.length === 0) {
      setMode("new_model")
      setBrandModelId("")
    }
  }, [open, loadingModels, brandModels.length, brandId])

  useEffect(() => {
    if (!open || loadingModels) return
    const needle = row.model_name?.trim().toLowerCase()
    if (!needle) return
    const hit = brandModels.find((m) => m.name.trim().toLowerCase() === needle)
    if (!hit) return
    setBrandModelId((prev) => (prev === "" ? hit.id : prev))
  }, [open, loadingModels, brandModels, row.model_name])

  async function onSubmit() {
    if (!brandId) {
      toast.error("Pick a catalog brand before converting (seller listing snapshots require brand_id)")
      setOpen(false)
      return
    }
    let body: Record<string, unknown>

    let priceParsed: number | null | undefined
    const pr = catalogPrice.trim()
    if (pr === "") {
      priceParsed = undefined
    } else {
      const n = Number.parseFloat(pr.replace(/,/g, ""))
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Catalog price must be a valid amount")
        return
      }
      priceParsed = n
    }

    const variantTrim = variantImageUrl?.trim()
    const variantImagePayload =
      variantTrim && URL.canParse(variantTrim) ? variantTrim : undefined

    const newModelImageTrim = newModelImageUrl?.trim()
    const newModelImagePayload =
      mode === "new_model" && newModelImageTrim && URL.canParse(newModelImageTrim)
        ? newModelImageTrim
        : undefined

    if (mode === "existing_model") {
      if (!brandModelId.trim()) {
        toast.error("Select a catalog model")
        return
      }
      body = {
        mode: "existing_model",
        brand_model_id: brandModelId.trim(),
        length_label: lengthLabel.trim(),
        width_label: widthLabel.trim(),
        thickness_label: thicknessLabel.trim(),
        volume_label: volumeLabel.trim(),
        fin_box_type: finBox,
        fin_boxes: finBoxesLayout,
        material: variantMaterial,
        condition,
        ...(priceParsed !== undefined ? { price: priceParsed } : {}),
        ...(variantImagePayload ? { variant_image_url: variantImagePayload } : {}),
      }
    } else {
      const nm = newModelName.trim()
      if (!nm) {
        toast.error("Enter a model name")
        return
      }
      const dup = brandModels.find((m) => m.name.trim().toLowerCase() === nm.toLowerCase())
      if (dup) {
        toast.error(
          `"${dup.name}" is already a model line — use "Attach variant to existing model line" and select it.`,
        )
        return
      }
      body = {
        mode: "new_model",
        new_model_name: nm,
        new_model_description:
          newModelDescription.trim().length > 0 ? newModelDescription.trim() : null,
        length_label: lengthLabel.trim(),
        width_label: widthLabel.trim(),
        thickness_label: thicknessLabel.trim(),
        volume_label: volumeLabel.trim(),
        fin_box_type: finBox,
        fin_boxes: finBoxesLayout,
        material: variantMaterial,
        condition,
        ...(priceParsed !== undefined ? { price: priceParsed } : {}),
        ...(newModelImagePayload ? { new_model_image_url: newModelImagePayload } : {}),
        ...(variantImagePayload ? { variant_image_url: variantImagePayload } : {}),
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/admin/user-listing-board-model-data/${encodeURIComponent(row.id)}/convert`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      )
      const j = (await res.json()) as {
        ok?: unknown
        data?: unknown
        error?: string
        /** catalog variant uuid */
      }
      if (!res.ok) {
        toast.error(typeof j?.error === "string" ? j.error : "Convert failed")
        return
      }
      toast.success("Added catalog variant")
      setOpen(false)
      onConverted()
    } finally {
      setSubmitting(false)
    }
  }

  const catalogLinesSummary =
    brandModels.length <= 4
      ? brandModels.map((m) => m.name.trim()).join(", ")
      : `${brandModels
          .slice(0, 3)
          .map((m) => m.name.trim())
          .join(", ")} +${brandModels.length - 3} more`

  const newModelTrimmed = newModelName.trim()
  const newModelDuplicateHit =
    mode === "new_model" && newModelTrimmed.length > 0
      ? brandModels.find(
          (m) => m.name.trim().toLowerCase() === newModelTrimmed.toLowerCase(),
        ) ?? null
      : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-auto w-full whitespace-normal px-2 py-1.5 text-xs leading-snug"
          disabled={disabled || !brandId}
        >
          Convert
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Convert snapshot to catalog variant</DialogTitle>
          <DialogDescription className="text-muted-foreground text-left text-xs leading-relaxed">
            The catalog brand is already set on this row. You are attaching one variant (dims, fins, condition,
            price) under a model line — pick an existing line or create a new line name first.
          </DialogDescription>
        </DialogHeader>

        {!brandId ? (
          <p className="text-destructive text-sm">
            Snapshot has no <code className="text-xs">brand_id</code>. Link listings to a catalog brand before
            using this workflow.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Brand:{" "}
              <span className="font-medium text-foreground">
                {row.brands?.name?.trim() ?? brandId.slice(0, 8)}
              </span>
              {brandSlugForModels ? (
                <>
                  {" "}
                  ·{" "}
                  <Link
                    href={`${BRANDS_BASE}/${encodeURIComponent(brandSlugForModels)}`}
                    className="text-primary underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open brand page
                  </Link>
                </>
              ) : null}
            </p>

            <div className="bg-muted/40 border-border space-y-2 rounded-md border px-3 py-2">
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                <span className="font-medium text-foreground">Model line</span> is the product family in the
                catalog (e.g. board name / shape line). <span className="font-medium text-foreground">Variant</span>{" "}
                is this specific size/build (fields below). The listing&apos;s{" "}
                <span className="font-medium text-foreground">saved model index</span> is a seller tag — not board
                type.
                {listingBoardTypeLabel ? (
                  <>
                    {" "}
                    Board type on listing:{" "}
                    <span className="font-medium text-foreground">{listingBoardTypeLabel}</span>
                  </>
                ) : null}
              </p>
              <div>
                <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                  Saved index / model label
                </p>
                <p className="text-foreground mt-0.5 text-sm font-medium">
                  {snapshotModelLabel || "Not set — use existing line or type a new line name below"}
                </p>
                {row.catalog_model_slug?.trim() ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Index slug: <span className="text-foreground">{row.catalog_model_slug.trim()}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                size="sm"
                variant={mode === "existing_model" ? "secondary" : "outline"}
                className="justify-center sm:flex-1"
                disabled={loadingModels || brandModels.length === 0}
                onClick={() => {
                  setMode("existing_model")
                }}
              >
                Attach variant to existing model line
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "new_model" ? "secondary" : "outline"}
                className="justify-center sm:flex-1"
                onClick={() => {
                  setMode("new_model")
                  setBrandModelId("")
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4 shrink-0" />
                Create new model line + variant
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-foreground">
                  {mode === "existing_model" ? (
                    <>
                      Catalog model lines
                      {!loadingModels ? (
                        <span className="text-muted-foreground font-normal"> ({brandModels.length})</span>
                      ) : null}
                    </>
                  ) : (
                    <>When creating a new line</>
                  )}
                </Label>
              </div>
              {loadingModels ? (
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> Loading models…
                </p>
              ) : brandModels.length === 0 ? (
                <div className="border-destructive/30 bg-destructive/5 rounded-md border px-3 py-2 text-xs">
                  <p className="text-foreground font-medium">No model lines in the catalog for this brand yet.</p>
                  <p className="text-muted-foreground mt-1">
                    Use <span className="text-foreground font-medium">Create new model line + variant</span> above
                    to name the first line and attach this board&apos;s variant in one step.
                  </p>
                </div>
              ) : mode === "existing_model" ? (
                <>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Pick the line this board belongs to. Dims, fins, and price below become a new variant under
                    that line.
                  </p>
                  <div className="border-input max-h-52 overflow-y-auto rounded-md border">
                    <ul className="divide-border divide-y">
                      {brandModels.map((m) => {
                        const selected = brandModelId === m.id
                        return (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setBrandModelId(m.id)
                              }}
                              className={cn(
                                "hover:bg-accent/60 w-full cursor-pointer px-3 py-2.5 text-left text-sm transition-colors",
                                selected && "bg-accent",
                              )}
                            >
                              <span className="font-medium">{m.name}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  {!brandModelId ? (
                    <p className="text-amber-700 dark:text-amber-400 text-xs">Select a model line to continue.</p>
                  ) : null}
                </>
              ) : (
                <div className="border-border bg-muted/30 space-y-2 rounded-md border px-3 py-2 text-xs">
                  <p className="text-foreground font-medium">This board already matches a catalog line?</p>
                  <p className="text-muted-foreground leading-relaxed">
                    This brand already has {brandModels.length} model line
                    {brandModels.length === 1 ? "" : "s"} ({catalogLinesSummary}). If this listing is just another
                    size or build of one of those, use{" "}
                    <button
                      type="button"
                      className="text-primary font-medium underline underline-offset-2"
                      onClick={() => setMode("existing_model")}
                    >
                      Attach variant to existing model line
                    </button>{" "}
                    and select it. Use the new name field only when the product family does not exist yet.
                  </p>
                </div>
              )}
            </div>

            {mode === "new_model" ? (
              <>
                {newModelDuplicateHit ? (
                  <div className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 rounded-md border px-3 py-2 text-xs">
                    <p className="text-foreground font-medium">
                      &ldquo;{newModelDuplicateHit.name}&rdquo; is already a model line
                    </p>
                    <p className="text-muted-foreground mt-1 leading-relaxed">
                      To add this board as a variant under that line, switch to{" "}
                      <button
                        type="button"
                        className="text-primary font-medium underline underline-offset-2"
                        onClick={() => {
                          setMode("existing_model")
                          setBrandModelId(newModelDuplicateHit.id)
                        }}
                      >
                        Attach variant to existing model line
                      </button>{" "}
                      and select it. The field below is only for naming a line that is not in the catalog yet.
                    </p>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="snap-nm-name">New catalog model line name</Label>
                  <Input
                    id="snap-nm-name"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder="Name for the new product family (not board type)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="snap-nm-desc">Model description (optional)</Label>
                  <textarea
                    id="snap-nm-desc"
                    className="border-input placeholder:text-muted-foreground focus-visible:ring-ring min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2"
                    value={newModelDescription}
                    onChange={(e) => setNewModelDescription(e.target.value)}
                  />
                </div>

                {!newModelDuplicateHit ? (
                  <div className="border-border bg-muted/25 space-y-3 rounded-md border px-3 py-2">
                    <div className="space-y-1">
                      <Label className="text-foreground">Model hero image (optional)</Label>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        Saved on the new catalog model line. Choose a seller photo from this listing, or upload
                        to catalog storage under board-models/.
                      </p>
                    </div>
                    {listingPickerImages.length === 0 ? (
                      <p className="text-muted-foreground text-xs">
                        No photos on this listing — upload below to supply a hero image.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {listingPickerImages.map((img) => {
                          const src = (img.thumbnail_url?.trim() || img.url).trim()
                          const sel = Boolean(newModelImageUrl?.trim()) && newModelImageUrl === img.url
                          return (
                            <button
                              key={`model-pick-${img.id}`}
                              type="button"
                              onClick={() => setNewModelImageUrl(img.url)}
                              className={cn(
                                "relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-md border-2 bg-muted transition-colors",
                                sel
                                  ? "border-primary ring-2 ring-primary/25"
                                  : "border-transparent hover:border-border",
                              )}
                              title="Use as model hero image"
                            >
                              <Image src={src} alt="" fill sizes="76px" className="object-cover" />
                            </button>
                          )
                        })}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={newModelImageInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          void (async () => {
                            const input = e.currentTarget
                            const f = input.files?.[0]
                            input.value = ""
                            if (!f) return
                            setNewModelImageUploading(true)
                            try {
                              const url = await uploadSnapshotConvertModelHeroFile(f)
                              if (url) setNewModelImageUrl(url)
                            } finally {
                              setNewModelImageUploading(false)
                            }
                          })()
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={newModelImageUploading}
                        onClick={() => newModelImageInputRef.current?.click()}
                      >
                        {newModelImageUploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                          </>
                        ) : (
                          <>
                            <ImagePlus className="mr-2 h-4 w-4 shrink-0" /> Upload image
                          </>
                        )}
                      </Button>
                      {newModelImageUrl?.trim() ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground h-auto px-2"
                          onClick={() => {
                            setNewModelImageUrl(null)
                            if (newModelImageInputRef.current)
                              newModelImageInputRef.current.value = ""
                          }}
                        >
                          Clear hero
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Length label (optional)</Label>
                <Input value={lengthLabel} onChange={(e) => setLengthLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Width label (optional)</Label>
                <Input value={widthLabel} onChange={(e) => setWidthLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Thickness label (optional)</Label>
                <Input value={thicknessLabel} onChange={(e) => setThicknessLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Volume label (optional)</Label>
                <Input value={volumeLabel} onChange={(e) => setVolumeLabel(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Fin plugs</Label>
                <Select value={finBox} onValueChange={(v) => setFinBox(v as typeof finBox)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="futures">Futures</SelectItem>
                    <SelectItem value="fcs">FCS II</SelectItem>
                    <SelectItem value="single_fin">Single fin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fin boxes</Label>
                <Select
                  value={finBoxesLayout}
                  onValueChange={(v) => setFinBoxesLayout(v as FinBoxesType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {FIN_BOXES_ADMIN_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Material</Label>
                <Select
                  value={variantMaterial}
                  onValueChange={(v) => setVariantMaterial(v as BrandModelVariantMaterial)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIANT_MATERIAL_ADMIN_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select
                  value={condition}
                  onValueChange={(v) => setCondition(v as BrandModelVariantCondition)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-52">
                    {listingConditionFilterRows().map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-border bg-muted/25 space-y-3 rounded-md border px-3 py-2">
              <div className="space-y-1">
                <Label className="text-foreground">Variant catalog image</Label>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  This size-specific photo in catalog. Prefer a seller image from below, or upload a board shot
                  under catalog storage (dimensions/).
                </p>
              </div>
              {listingPickerImages.length === 0 ? (
                <p className="text-muted-foreground text-xs">No seller photos linked on this listing — upload below.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {listingPickerImages.map((img) => {
                    const src = (img.thumbnail_url?.trim() || img.url).trim()
                    const sel =
                      Boolean(variantImageUrl?.trim()) && variantImageUrl?.trim() === img.url.trim()
                    return (
                      <button
                        key={`variant-pick-${img.id}`}
                        type="button"
                        onClick={() => setVariantImageUrl(img.url)}
                        className={cn(
                          "relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-md border-2 bg-muted transition-colors",
                          sel
                            ? "border-primary ring-2 ring-primary/25"
                            : "border-transparent hover:border-border",
                        )}
                        title="Use as variant catalog image"
                      >
                        <Image src={src} alt="" fill sizes="76px" className="object-cover" />
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={variantImageInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    void (async () => {
                      const input = e.currentTarget
                      const f = input.files?.[0]
                      input.value = ""
                      if (!f) return
                      setVariantImageUploading(true)
                      try {
                        const url = await uploadSnapshotConvertVariantFile(f)
                        if (url) setVariantImageUrl(url)
                      } finally {
                        setVariantImageUploading(false)
                      }
                    })()
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={variantImageUploading}
                  onClick={() => variantImageInputRef.current?.click()}
                >
                  {variantImageUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                    </>
                  ) : (
                    <>
                      <ImagePlus className="mr-2 h-4 w-4 shrink-0" /> Upload variant image
                    </>
                  )}
                </Button>
                {variantImageUrl?.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-auto px-2"
                    onClick={() => {
                      setVariantImageUrl(null)
                      if (variantImageInputRef.current) variantImageInputRef.current.value = ""
                    }}
                  >
                    Clear variant image
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Variant MSRP (USD, optional)</Label>
              <Input
                value={catalogPrice}
                onChange={(e) => setCatalogPrice(e.target.value)}
                placeholder="Defaults from snapshot listing price when omitted"
              />
              <p className="text-muted-foreground text-xs">
                Stored on the catalog variant. Prefilled from the live listing price when available; leave blank
                to fall back to this row&apos;s snapshot price (
                {row.listing_price != null ? `$${Number(row.listing_price).toFixed(2)}` : "none"}).
              </p>
            </div>

            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Prefilled condition / fins (listing when present):&nbsp;
              <span className="text-foreground">{formatCondition(condition)}</span> · fins_setup:&nbsp;
              <span className="text-foreground">
                {row.listings?.fins_setup?.trim() || "—"}
              </span>
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onSubmit()}
            disabled={
              submitting ||
              !brandId ||
              (mode === "existing_model" && brandModels.length > 0 && !brandModelId.trim()) ||
              Boolean(mode === "new_model" && newModelDuplicateHit)
            }
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Converting…
              </>
            ) : mode === "new_model" ? (
              "Create model & variant"
            ) : (
              "Add catalog variant"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

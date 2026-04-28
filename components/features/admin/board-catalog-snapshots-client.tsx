"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Loader2, PlusCircle } from "lucide-react"
import { toast } from "sonner"

import type { BrandModelVariantCondition } from "@/lib/validations/brand-model-variants"
import { finBoxTypeFromListingFinsSetup } from "@/lib/utils/fins-setup-to-fin-box"
import {
  formatBoardType,
  formatCondition,
  isListingSellableCondition,
  listingConditionFilterRows,
  sellFormConditionValue,
} from "@/lib/listing-labels"
import { buildBoardCatalogDimensionLabelsFromListingRow } from "@/lib/utils/listing-board-catalog-snapshot"

import type {
  UserListingBoardModelDataRow,
  UserListingBoardModelDataListingEmbed,
} from "@/lib/db/user-listing-board-model-data"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { slugifyBrandName } from "@/lib/brands/slug"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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

/** Prefer live listing dims; otherwise snapshot dimension labels still on `user_listing_board_model_data`. */
function dimsSummaryFromSnapshotRow(r: SnapshotAdminRowApi): string {
  const lg = r.listings
  const hasListingDims =
    lg != null &&
    (lg.length_feet != null ||
      lg.length_inches != null ||
      Boolean(lg.length_inches_display?.trim()) ||
      lg.width != null ||
      Boolean(lg.width_inches_display?.trim()) ||
      lg.thickness != null ||
      Boolean(lg.thickness_inches_display?.trim()) ||
      lg.volume != null ||
      Boolean(lg.volume_display?.trim()))

  if (hasListingDims && lg) {
    const built = buildBoardCatalogDimensionLabelsFromListingRow({
      length_feet: lg.length_feet,
      length_inches: lg.length_inches,
      length_inches_display: lg.length_inches_display,
      width: lg.width,
      width_inches_display: lg.width_inches_display,
      thickness: lg.thickness,
      thickness_inches_display: lg.thickness_inches_display,
      volume: lg.volume,
      volume_display: lg.volume_display,
    })
    const s = built.dimensions_summary.trim()
    if (s) return s
  }

  const pieces = [r.length_label, r.width_label, r.thickness_label].filter(Boolean) as string[]
  const mid = pieces.join(" × ")
  const vol = r.volume_label?.trim() ?? ""
  const out = vol ? `${mid}${mid ? " — " : ""}${vol}` : mid
  return out.trim() || "—"
}

function listingUpdatedLabel(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—"
  try {
    return format(new Date(iso.trim()), "MMM d yyyy")
  } catch {
    return "—"
  }
}

export function BoardCatalogSnapshotsClient() {
  const [pendingOnly, setPendingOnly] = useState(true)
  const [rows, setRows] = useState<SnapshotAdminRowApi[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

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

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Board catalog snapshots</h1>
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

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No rows yet.</p>
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
              {rows.map((r) => (
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
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
      const res = await fetch("/api/admin/brands", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name,
          short_description: newBrandShortDescription.trim() || null,
          website_url: null,
          logo_url: null,
          founder_name: null,
          lead_shaper_name: null,
          location_label: null,
          model_count: 0,
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-lg">
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
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="attach-new-brand-name">Brand name</Label>
              <Input
                id="attach-new-brand-name"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="e.g. as it should appear in the catalog"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attach-new-brand-slug">URL slug</Label>
              <Input
                id="attach-new-brand-slug"
                value={newBrandSlug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setNewBrandSlug(e.target.value)
                }}
                placeholder="lowercase-with-hyphens"
                autoComplete="off"
              />
              <p className="text-muted-foreground text-[11px]">
                Filled automatically from the name; edit if the slug is taken.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attach-new-brand-desc">Short description (optional)</Label>
              <Input
                id="attach-new-brand-desc"
                value={newBrandShortDescription}
                onChange={(e) => setNewBrandShortDescription(e.target.value)}
                placeholder="One line for the brand profile"
              />
            </div>
          </div>
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
  const [condition, setCondition] = useState<BrandModelVariantCondition>(
    row.condition as BrandModelVariantCondition,
  )
  const [catalogPrice, setCatalogPrice] = useState("")
  const [submitting, setSubmitting] = useState(false)

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

    const hasListingDims =
      lg != null &&
      (lg.length_feet != null ||
        lg.length_inches != null ||
        Boolean(lg.length_inches_display?.trim()) ||
        lg.width != null ||
        Boolean(lg.width_inches_display?.trim()) ||
        lg.thickness != null ||
        Boolean(lg.thickness_inches_display?.trim()) ||
        lg.volume != null ||
        Boolean(lg.volume_display?.trim()))

    const dimsFromListing = hasListingDims
      ? buildBoardCatalogDimensionLabelsFromListingRow({
          length_feet: lg.length_feet,
          length_inches: lg.length_inches,
          length_inches_display: lg.length_inches_display,
          width: lg.width,
          width_inches_display: lg.width_inches_display,
          thickness: lg.thickness,
          thickness_inches_display: lg.thickness_inches_display,
          volume: lg.volume,
          volume_display: lg.volume_display,
        })
      : null

    setLengthLabel(coalesceSnapshotThenListing(row.length_label, dimsFromListing?.length_label))
    setWidthLabel(coalesceSnapshotThenListing(row.width_label, dimsFromListing?.width_label))
    setThicknessLabel(coalesceSnapshotThenListing(row.thickness_label, dimsFromListing?.thickness_label))
    setVolumeLabel(coalesceSnapshotThenListing(row.volume_label, dimsFromListing?.volume_label))

    const finsRaw = lg?.fins_setup?.trim() || null
    setFinBox(finBoxTypeFromListingFinsSetup(finsRaw))

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
        condition,
        ...(priceParsed !== undefined ? { price: priceParsed } : {}),
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
        condition,
        ...(priceParsed !== undefined ? { price: priceParsed } : {}),
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fin box</Label>
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

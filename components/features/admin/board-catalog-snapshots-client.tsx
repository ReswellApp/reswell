"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { BrandModelVariantCondition } from "@/lib/validations/brand-model-variants"
import { finBoxTypeFromListingFinsSetup } from "@/lib/utils/fins-setup-to-fin-box"
import {
  formatCondition,
  listingConditionFilterRows,
} from "@/lib/listing-labels"

import type { UserListingBoardModelDataRow } from "@/lib/db/user-listing-board-model-data"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
  listings?:
    | { title: string | null; slug: string | null; status: string | null }
    | null
    | undefined
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Board catalog snapshots</h1>
          <p className="text-muted-foreground text-sm">
            Aggregated surfboard listing fields from sellers ({total} matching). Use{" "}
            <span className="font-medium text-foreground">Convert</span> to add a normalized row under{" "}
            <Link href={`${BRANDS_BASE}`} className="text-primary underline-offset-2 hover:underline">
              brand models → variants
            </Link>
            , or dismiss rows you do not catalog.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={pendingOnly ? "secondary" : "outline"}
            onClick={() => setPendingOnly(!pendingOnly)}
          >
            {pendingOnly ? "Showing pending only" : "Showing all statuses"}
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Saved</TableHead>
              <TableHead>Listing</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Dimensions</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Sold</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                  {format(new Date(r.updated_at ?? r.created_at), "MMM d yyyy")}
                </TableCell>
                <TableCell className="max-w-[220px]">
                  {(() => {
                    const snapUrl =
                      typeof r.listing_url === "string" &&
                      r.listing_url.trim().startsWith("/l/")
                        ? r.listing_url.trim()
                        : ""
                    const lg = r.listings
                    const slug = lg && typeof lg.slug === "string" ? lg.slug : null
                    const title = lg && typeof lg.title === "string" ? lg.title : "Listing"
                    const href = snapUrl || listingHref(slug)
                    return href ? (
                      <Link href={href} className="text-primary truncate font-medium hover:underline">
                        {title}
                      </Link>
                    ) : (
                      <span className="truncate">{title}</span>
                    )
                  })()}
                </TableCell>
                <TableCell>
                  {(() => {
                    const b = r.brands?.name?.trim()
                    const slug = r.brands?.slug?.trim()
                    const label = r.brand_id ? b ?? "Brand ID set" : "—"
                    return slug ? (
                      <Link
                        href={`${BRANDS_BASE}/${encodeURIComponent(slug)}`}
                        className="hover:underline"
                      >
                        {label}
                      </Link>
                    ) : (
                      label
                    )
                  })()}
                </TableCell>
                <TableCell className="max-w-[140px] text-sm">
                  {r.model_name?.trim() ?? "—"}
                </TableCell>
                <TableCell className="max-w-[200px] text-xs leading-snug">{r.dimensions || "—"}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums text-sm">${r.listing_price.toFixed(2)}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {r.sold_price != null ? `$${Number(r.sold_price).toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {r.converted_brand_model_variant_id ? (
                    <span className="text-emerald-600">Converted</span>
                  ) : r.dismissed_at ? (
                    <span>Dismissed</span>
                  ) : (
                    <span className="text-muted-foreground">Open</span>
                  )}
                </TableCell>
                <TableCell className="space-y-2 text-right">
                  <ConvertCatalogSnapshotDialog
                    row={r}
                    disabled={Boolean(r.dismissed_at) || Boolean(r.converted_brand_model_variant_id)}
                    onConverted={() => void load()}
                  />
                  {!r.dismissed_at && !r.converted_brand_model_variant_id && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full md:w-auto"
                      onClick={async () => {
                        const res = await fetch(
                          `/api/admin/user-listing-board-model-data/${encodeURIComponent(r.id)}`,
                          {
                            method: "PATCH",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ dismissed: true }),
                          },
                        )
                        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
                        if (!res.ok || !j.ok) {
                          toast.error(j.error || "Could not dismiss")
                          return
                        }
                        toast.success("Dismissed")
                        void load()
                      }}
                    >
                      Dismiss
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
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
    finBoxTypeFromListingFinsSetup(row.fins_setup ?? null),
  )
  const [condition, setCondition] = useState<BrandModelVariantCondition>(
    row.condition as BrandModelVariantCondition,
  )
  const [catalogPrice, setCatalogPrice] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !brandId) return

    let cancelled = false
    async function fetchModels() {
      setLoadingModels(true)
      try {
        const res = await fetch(
          `/api/admin/brand-models?brand_id=${encodeURIComponent(brandId)}`,
          { credentials: "include" },
        )
        const j = (await res.json()) as {
          data?: { rows?: BrandModelItem[] }
          error?: string
        }
        const list = Array.isArray(j.data?.rows) ? j.data!.rows! : []
        if (!cancelled) setBrandModels(list ?? [])
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
    const sl = row.length_label ?? ""
    const sw = row.width_label ?? ""
    const st = row.thickness_label ?? ""
    const sv = row.volume_label ?? ""
    setFinBox(finBoxTypeFromListingFinsSetup(row.fins_setup ?? null))
    setCondition(row.condition as BrandModelVariantCondition)
    setLengthLabel(sl)
    setWidthLabel(sw)
    setThicknessLabel(st)
    setVolumeLabel(sv)
    setBrandModelId("")
    setNewModelName(row.model_name?.trim() ?? "")
    setNewModelDescription("")
    const priceStr =
      row.listing_price != null && Number.isFinite(row.listing_price) ? String(row.listing_price) : ""
    setCatalogPrice(priceStr)
    setMode("existing_model")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when opening snapshot
  }, [open, row])

  async function onSubmit() {
    if (!brandId) {
      toast.error("Pick a catalog brand before converting (seller listing snapshots require brand_id)")
      setOpen(false)
      return
    }
    if (
      !lengthLabel.trim() ||
      !widthLabel.trim() ||
      !thicknessLabel.trim() ||
      !volumeLabel.trim()
    ) {
      toast.error("All dimension labels are required")
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm" disabled={disabled || !brandId}>
          Convert
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert snapshot to catalog variant</DialogTitle>
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

            <div className="space-y-2">
              <Label>Mode</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as "existing_model" | "new_model")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="snap-exist" value="existing_model" />
                  <Label htmlFor="snap-exist">Link to existing catalog model</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="snap-new" value="new_model" />
                  <Label htmlFor="snap-new">Create new catalog model, then add this variant row</Label>
                </div>
              </RadioGroup>
            </div>

            {mode === "existing_model" ? (
              <div className="space-y-2">
                <Label>Catalog model</Label>
                {loadingModels ? (
                  <p className="text-muted-foreground text-xs flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading models…
                  </p>
                ) : brandModels.length === 0 ? (
                  <p className="text-destructive text-xs">No catalog models yet for this brand.</p>
                ) : (
                  <Select value={brandModelId} onValueChange={setBrandModelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a model…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {brandModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="snap-nm-name">New model name</Label>
                  <Input
                    id="snap-nm-name"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder=""
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="snap-nm-desc">Description (optional)</Label>
                  <textarea
                    id="snap-nm-desc"
                    className="border-input placeholder:text-muted-foreground focus-visible:ring-ring min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2"
                    value={newModelDescription}
                    onChange={(e) => setNewModelDescription(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Length label</Label>
                <Input value={lengthLabel} onChange={(e) => setLengthLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Width label</Label>
                <Input value={widthLabel} onChange={(e) => setWidthLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Thickness label</Label>
                <Input value={thicknessLabel} onChange={(e) => setThicknessLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Volume label</Label>
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
                Stored on the catalog variant. Leave blank to use this snapshot&apos;s listing price ({row.listing_price != null ? `$${Number(row.listing_price).toFixed(2)}` : ""}).
              </p>
            </div>

            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Snapshot listing condition:&nbsp;
              <span className="text-foreground">{formatCondition(row.condition)}</span> · fins_setup:&nbsp;
              <span className="text-foreground">{row.fins_setup?.trim() || "—"}</span>
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSubmit()} disabled={submitting || !brandId}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Converting…
              </>
            ) : (
              "Create variant"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

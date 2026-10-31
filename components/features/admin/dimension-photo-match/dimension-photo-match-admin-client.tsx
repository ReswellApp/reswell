"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { listingPhotoFillClassName } from "@/lib/listing-photo-fill"
import { cn } from "@/lib/utils"
import type {
  SurfboardDimensionPhotoMatchRow,
  SurfboardDimensionPhotoMatchStats,
} from "@/lib/db/surfboardDimensionPhoto"
import { Loader2, Minus, Plus, RefreshCw, RotateCcw, ZoomIn } from "lucide-react"

type RatingFilter = "all" | "unrated" | "good" | "close" | "bad" | "excluded"
type AspectRating = "good" | "close" | "bad"

function deriveMatchRating(
  photo: string | null | undefined,
  dims: string | null | undefined,
): AspectRating | null {
  if (photo === "bad" || dims === "bad") return "bad"
  if (photo === "good" && dims === "good") return "good"
  if (photo === "close" || dims === "close") return "close"
  return null
}

function predictedDimsLine(row: SurfboardDimensionPhotoMatchRow): string {
  const core = [row.predictedLength, row.predictedWidth, row.predictedThickness]
    .filter(Boolean)
    .join(" × ")
  if (!core) return "—"
  return row.predictedVolume ? `${core} · ${row.predictedVolume}L` : core
}

/** Prefer the photo the LLM said contains the dimensions stamp. */
function sourcePhoto(row: SurfboardDimensionPhotoMatchRow): string | null {
  if (row.sourceImageUrl?.trim()) return row.sourceImageUrl.trim()
  const marked = row.inputPreview.find((p) => p.shot === "dimensions")
  if (marked?.imageUrl) return marked.imageUrl
  return row.inputPreview[0]?.imageUrl ?? null
}

function jevHintLine(row: SurfboardDimensionPhotoMatchRow): string | null {
  const jev = row.jevReview
  if (!jev || jev.source !== "jev") return null
  const parts: string[] = []
  if (jev.photoVerdict === "accept") parts.push("Photo ok")
  else if (jev.photoVerdict === "reject") parts.push("Photo ?")
  if (jev.dimsVerdict) parts.push(`Dims ${jev.dimsVerdict}`)
  if (jev.volumeCleared) parts.push("vol cleared")
  if (jev.retriedWithExamples) parts.push("retried")
  if (parts.length === 0 && jev.reason) return `Jev · ${jev.reason}`
  if (parts.length === 0) return null
  return `Jev · ${parts.join(" · ")}`
}

export function DimensionPhotoMatchAdminClient() {
  const [filter, setFilter] = useState<RatingFilter>("unrated")
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState<SurfboardDimensionPhotoMatchRow[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<SurfboardDimensionPhotoMatchStats | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [rematching, setRematching] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [matching, setMatching] = useState(false)
  const [lightbox, setLightbox] = useState<SurfboardDimensionPhotoMatchRow | null>(null)
  const [zoom, setZoom] = useState(1)
  const fileRef = useRef<HTMLInputElement>(null)
  const zoomRef = useRef<ReactZoomPanPinchContentRef | null>(null)

  const load = useCallback(
    async (silent: boolean, ratingOverride?: RatingFilter) => {
      if (!silent) setLoading(true)
      const rating = ratingOverride ?? filter
      try {
        const params = new URLSearchParams({
          days: "90",
          rating,
          limit: "100",
        })
        const res = await fetch(`/api/admin/dimension-photo-match?${params}`)
        const body = (await res.json().catch(() => ({}))) as {
          data?: {
            matches: SurfboardDimensionPhotoMatchRow[]
            total: number
            stats: SurfboardDimensionPhotoMatchStats
          }
          error?: string
        }
        if (!res.ok) {
          const message = body.error || "Could not load library"
          setLoadError(message)
          if (!silent) toast.error(message)
          return
        }
        setLoadError(null)
        setMatches(body.data?.matches ?? [])
        setTotal(body.data?.total ?? 0)
        setStats(body.data?.stats ?? null)
      } catch {
        setLoadError("Could not load library")
        if (!silent) toast.error("Could not load library")
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [filter],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  useEffect(() => {
    setZoom(1)
    zoomRef.current?.resetTransform(0)
  }, [lightbox?.id])

  async function syncListings() {
    setScanning(true)
    try {
      const res = await fetch("/api/admin/dimension-photo-match/refs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 12 }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        data?: { scanned: number; found: number; skipped: number }
        error?: string
      }
      if (!res.ok || !body.data) {
        toast.error(body.error || "Scan failed")
        return
      }
      if (body.data.scanned === 0) {
        toast.message(
          "No unscanned active/sold surfboards left — rate existing rows, Rematch Bad/Close, or wait for new listings",
        )
      } else if (body.data.found === 0) {
        toast.message(
          `Scanned ${body.data.scanned} · no readable dims (${body.data.skipped} skipped). Check Unrated for pick-only rows.`,
        )
      } else {
        toast.success(
          `Scanned ${body.data.scanned} listings · found dims on ${body.data.found}`,
        )
      }
      setFilter("unrated")
      await load(false, "unrated")
    } catch {
      toast.error("Scan failed")
    } finally {
      setScanning(false)
    }
  }

  async function rematchFailures() {
    setRematching(true)
    try {
      const res = await fetch("/api/admin/dimension-photo-match/rematch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 12 }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        data?: { attempted: number; created: number; skipped: number }
        error?: string
      }
      if (!res.ok || !body.data) {
        toast.error(body.error || "Rematch failed")
        return
      }
      if (body.data.created === 0) {
        toast.message(
          body.data.attempted === 0
            ? "No Bad/Close matches left to rematch"
            : `Tried ${body.data.attempted}, none created (${body.data.skipped} skipped)`,
        )
      } else {
        toast.success(
          `Rematched ${body.data.created} — prior Bad/Close kept; new rows are Unrated`,
        )
      }
      setFilter("unrated")
      await load(false, "unrated")
    } catch {
      toast.error("Rematch failed")
    } finally {
      setRematching(false)
    }
  }

  async function excludeMatch(row: SurfboardDimensionPhotoMatchRow) {
    if (busyId) return
    setBusyId(row.id)
    setMatches((prev) =>
      prev.map((m) =>
        m.id === row.id
          ? { ...m, excludedAt: new Date().toISOString(), ratedAt: new Date().toISOString() }
          : m,
      ),
    )
    try {
      const res = await fetch(`/api/admin/dimension-photo-match/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          excluded: true,
          note: "Excluded — do not rematch or scan again",
          promoteToRefs: false,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        data?: SurfboardDimensionPhotoMatchRow
        error?: string
      }
      if (!res.ok || !body.data) {
        toast.error(body.error || "Could not exclude")
        void load(true)
        return
      }
      toast.success("Excluded — won’t rematch; similar cases skipped in memory")
      setLightbox((prev) => (prev?.id === body.data!.id ? null : prev))
      if (filter === "unrated") {
        setMatches((prev) => prev.filter((m) => m.id !== body.data!.id))
      }
      void load(true)
    } catch {
      toast.error("Could not exclude")
      void load(true)
    } finally {
      setBusyId(null)
    }
  }

  async function rateAspect(
    row: SurfboardDimensionPhotoMatchRow,
    aspect: "photo" | "dims",
    value: AspectRating,
  ) {
    if (busyId || row.excludedAt) return
    // Photo is binary; Close is dims-only.
    if (aspect === "photo" && value === "close") return
    setBusyId(row.id)
    // Wrong photo ⇒ dims from that photo are also untrustworthy.
    const nextPhoto = aspect === "photo" ? value : row.photoRating
    const nextDims =
      aspect === "photo" && value === "bad"
        ? "bad"
        : aspect === "dims"
          ? value
          : row.dimsRating
    setMatches((prev) =>
      prev.map((m) =>
        m.id === row.id
          ? {
              ...m,
              photoRating: nextPhoto ?? m.photoRating,
              dimsRating: nextDims ?? m.dimsRating,
              matchRating: deriveMatchRating(nextPhoto, nextDims) ?? m.matchRating,
            }
          : m,
      ),
    )
    try {
      const res = await fetch(`/api/admin/dimension-photo-match/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoRating: aspect === "photo" ? value : undefined,
          dimsRating:
            aspect === "dims"
              ? value
              : aspect === "photo" && value === "bad"
                ? "bad"
                : undefined,
          promoteToRefs: true,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        data?: SurfboardDimensionPhotoMatchRow
        error?: string
      }
      if (!res.ok || !body.data) {
        toast.error(body.error || "Could not save")
        void load(true)
        return
      }
      setMatches((prev) => prev.map((m) => (m.id === body.data!.id ? body.data! : m)))
      setLightbox((prev) => (prev?.id === body.data!.id ? body.data! : prev))
      void load(true)
    } catch {
      toast.error("Could not save")
      void load(true)
    } finally {
      setBusyId(null)
    }
  }

  async function runMatch(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.size > 0)
    if (list.length < 1 || matching) return
    setMatching(true)
    let ok = 0
    let failed = 0
    const progressToast =
      list.length > 1 ? toast.loading(`Matching 0 / ${list.length}…`) : null
    try {
      // One request per photo so large batches stay under body-size limits and each
      // stamp gets its own review row for rating / memory.
      for (let i = 0; i < list.length; i++) {
        const file = list[i]!
        if (progressToast != null) {
          toast.loading(`Matching ${i + 1} / ${list.length}…`, { id: progressToast })
        }
        try {
          const body = new FormData()
          body.append("photos", file)
          const res = await fetch("/api/admin/dimension-photo-match/test", {
            method: "POST",
            body,
          })
          const payload = (await res.json().catch(() => ({}))) as {
            data?: { match: SurfboardDimensionPhotoMatchRow }
            error?: string
          }
          if (!res.ok || !payload.data?.match) {
            failed += 1
            continue
          }
          ok += 1
        } catch {
          failed += 1
        }
      }
      if (progressToast != null) toast.dismiss(progressToast)
      if (ok > 0 && failed === 0) {
        toast.success(
          ok === 1
            ? "Added — rate Photo + Dims"
            : `Added ${ok} photos — rate Photo + Dims on each`,
        )
      } else if (ok > 0) {
        toast.warning(`Added ${ok}, ${failed} failed`)
      } else {
        toast.error("Could not match those photos")
        return
      }
      if (filter === "unrated") await load(false)
      else setFilter("unrated")
    } catch {
      if (progressToast != null) toast.dismiss(progressToast)
      toast.error("Could not match those photos")
    } finally {
      setMatching(false)
    }
  }

  const tagCounts = {
    all: stats?.total ?? total,
    unrated: stats?.unrated ?? 0,
    good: stats?.good ?? 0,
    close: stats?.close ?? 0,
    bad: stats?.bad ?? 0,
    excluded: stats?.excluded ?? 0,
  }

  const lightboxSrc = lightbox ? sourcePhoto(lightbox) : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vision library
          </p>
          <h2 className="text-xl font-semibold text-foreground">Dimension photo match</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Rate <span className="text-foreground">Photo</span> and{" "}
            <span className="text-foreground">Dims</span>. Each rating is injected into the next
            scan as examples (Good/Bad stamp photos + text) — keep marking Photo Bad on wrong
            picks; that trains picking fastest. Jev checks the vision result afterward (volume,
            confidence, soft hints) — it never auto-rates for you.
            {stats?.refCount ? (
              <span className="text-foreground/80"> {stats.refCount} pairs in memory.</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void runMatch(e.target.files)
              e.target.value = ""
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={scanning || rematching}
            onClick={() => void syncListings()}
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">{scanning ? "Scanning…" : "Scan listings"}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={scanning || rematching}
            onClick={() => void rematchFailures()}
            title="Re-run Bad and Close matches as new rows (keeps the old ones)"
          >
            {rematching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            <span className="ml-2">{rematching ? "Rematching…" : "Rematch bad/close"}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={matching}
            onClick={() => fileRef.current?.click()}
          >
            {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2">{matching ? "Matching…" : "Upload photos"}</span>
          </Button>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <AccuracyCard
            title="Photo"
            subtitle="Did it pick the stamp photo?"
            accuracy={stats.photoAccuracy}
            summary={
              stats.photoRated > 0
                ? `Right on ${stats.photoGood} of ${stats.photoRated} you rated`
                : "Rate some photos to see this"
            }
            target={stats.target}
          />
          <AccuracyCard
            title="Dims"
            subtitle="Did it read L × W × T correctly?"
            accuracy={stats.dimsAccuracy}
            summary={
              stats.dimsRated > 0
                ? `Right on ${stats.dimsGood}, close on ${stats.dimsClose}, wrong on ${stats.dimsBad}`
                : "Rate some dims to see this"
            }
            target={stats.target}
          />
          <AccuracyCard
            title="Overall"
            subtitle="Photo and dims both right?"
            accuracy={stats.overallAccuracy}
            summary={
              stats.overallRated > 0
                ? `Fully right on ${stats.overallGood} of ${stats.overallRated}`
                : "Needs both Photo and Dims rated"
            }
            target={stats.target}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "all", label: "All" },
            { key: "unrated", label: "Unrated" },
            { key: "good", label: "Good" },
            { key: "close", label: "Close" },
            { key: "bad", label: "Bad" },
            { key: "excluded", label: "Excluded" },
          ] as const
        ).map((tag) => {
          const active = filter === tag.key
          return (
            <button
              key={tag.key}
              type="button"
              onClick={() => setFilter(tag.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                tag.key === "good" && active && "border-emerald-500 bg-emerald-600 text-white",
                tag.key === "close" && active && "border-amber-500 bg-amber-500 text-white",
                tag.key === "bad" && active && "border-rose-500 bg-rose-600 text-white",
                tag.key === "excluded" && active && "border-slate-500 bg-slate-600 text-white",
                (tag.key === "all" || tag.key === "unrated") &&
                  active &&
                  "border-slate-800 bg-slate-900 text-white",
                !active &&
                  tag.key === "good" &&
                  "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300",
                !active &&
                  tag.key === "close" &&
                  "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300",
                !active &&
                  tag.key === "bad" &&
                  "border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-300",
                !active &&
                  tag.key === "excluded" &&
                  "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300",
                !active &&
                  (tag.key === "all" || tag.key === "unrated") &&
                  "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {tag.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[11px] tabular-nums",
                  active ? "bg-white/20 text-inherit" : "bg-black/5 text-slate-600",
                )}
              >
                {tagCounts[tag.key]}
              </span>
            </button>
          )
        })}
      </div>

      {loadError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {loadError}
        </p>
      ) : null}

      {loading && matches.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading library…
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Scan listings so the model can find size-stamp photos and read dimensions, or add your
            own photos.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void syncListings()}>
              Scan listings
            </Button>
            <Button type="button" size="sm" onClick={() => fileRef.current?.click()}>
              Add photos
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {matches.map((row) => {
            const src = sourcePhoto(row)
            const busy = busyId === row.id
            const dims = predictedDimsLine(row)
            return (
              <article key={row.id} className="overflow-hidden rounded-xl border bg-white">
                <div className="relative aspect-[3/4] bg-slate-100">
                  {src ? (
                    <button
                      type="button"
                      className="absolute inset-0 z-0"
                      onClick={() => setLightbox(row)}
                      aria-label="Enlarge dimensions photo"
                    >
                      <Image
                        src={src}
                        alt={dims}
                        fill
                        unoptimized
                        className={listingPhotoFillClassName}
                        sizes="220px"
                      />
                      <span className="absolute bottom-2 right-2 rounded-full bg-black/55 p-1.5 text-white shadow">
                        <ZoomIn className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No dimensions photo
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-1 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white drop-shadow">
                      Photo
                    </p>
                    <div className="pointer-events-auto flex justify-between gap-1">
                      <AspectTag
                        label="Good"
                        tone="good"
                        selected={row.photoRating === "good"}
                        muted={Boolean(row.photoRating) && row.photoRating !== "good"}
                        disabled={busy || Boolean(row.excludedAt)}
                        onClick={() => void rateAspect(row, "photo", "good")}
                      />
                      <AspectTag
                        label="Bad"
                        tone="bad"
                        selected={row.photoRating === "bad"}
                        muted={Boolean(row.photoRating) && row.photoRating !== "bad"}
                        disabled={busy || Boolean(row.excludedAt)}
                        onClick={() => void rateAspect(row, "photo", "bad")}
                      />
                    </div>
                  </div>
                  {busy ? (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2 px-2.5 py-2">
                  {row.excludedAt ? (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Excluded · skip forever
                    </p>
                  ) : row.priorMatchId ? (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                      Rematch · prior kept
                    </p>
                  ) : null}
                  <p className="truncate text-xs font-medium tabular-nums text-foreground" title={dims}>
                    {dims}
                  </p>
                  {jevHintLine(row) ? (
                    <p
                      className={cn(
                        "truncate text-[10px]",
                        row.jevReview?.photoVerdict === "reject" ||
                          row.jevReview?.dimsVerdict === "bad" ||
                          row.predictedConfidence === "low"
                          ? "text-amber-700"
                          : "text-muted-foreground",
                      )}
                      title={row.jevReview?.reason ?? undefined}
                    >
                      {jevHintLine(row)}
                    </p>
                  ) : null}
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Dims
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <AspectTag
                        label="Good"
                        tone="good"
                        selected={row.dimsRating === "good"}
                        muted={Boolean(row.dimsRating) && row.dimsRating !== "good"}
                        disabled={busy || Boolean(row.excludedAt)}
                        onClick={() => void rateAspect(row, "dims", "good")}
                        solid
                      />
                      <AspectTag
                        label="Close"
                        tone="close"
                        selected={row.dimsRating === "close"}
                        muted={Boolean(row.dimsRating) && row.dimsRating !== "close"}
                        disabled={busy || Boolean(row.excludedAt)}
                        onClick={() => void rateAspect(row, "dims", "close")}
                        solid
                      />
                      <AspectTag
                        label="Bad"
                        tone="bad"
                        selected={row.dimsRating === "bad"}
                        muted={Boolean(row.dimsRating) && row.dimsRating !== "bad"}
                        disabled={busy || Boolean(row.excludedAt)}
                        onClick={() => void rateAspect(row, "dims", "bad")}
                        solid
                      />
                    </div>
                  </div>
                  {!row.excludedAt ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void excludeMatch(row)}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Exclude
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {total > matches.length ? (
        <p className="text-center text-xs text-muted-foreground">
          Showing {matches.length} of {total}
        </p>
      ) : null}

      <Dialog open={Boolean(lightbox)} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent
          className="flex max-h-[94dvh] w-[min(98vw,64rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 pr-12 text-left">
            <DialogTitle className="text-base">
              {lightbox ? predictedDimsLine(lightbox) : "Photo"}
            </DialogTitle>
            <DialogDescription>
              {lightbox?.priorMatchId
                ? "Rematch of a prior Bad/Close run — both attempts are saved. "
                : null}
              Scroll to zoom, drag to pan, double-click to toggle. Rate whether the photo and the
              read dims are correct — that trains the model.
            </DialogDescription>
          </DialogHeader>
          {lightboxSrc ? (
            <div className="relative min-h-0 flex-1 bg-slate-950">
              <TransformWrapper
                ref={zoomRef}
                initialScale={1}
                minScale={1}
                maxScale={8}
                centerOnInit
                centerZoomedOut
                limitToBounds={false}
                smooth
                wheel={{ step: 0.14 }}
                panning={{
                  disabled: zoom <= 1.02,
                  allowLeftClickPan: zoom > 1.02,
                  velocityDisabled: false,
                }}
                pinch={{ step: 3.2, allowPanning: true }}
                doubleClick={{ mode: "toggle", step: 2.5 }}
                onTransform={(_ctx, state) => setZoom(state.scale)}
              >
                <TransformComponent
                  wrapperClass="!h-[min(58dvh,32rem)] !w-full !cursor-grab active:!cursor-grabbing"
                  contentClass="!flex !h-full !w-full !items-center !justify-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lightboxSrc}
                    alt="Dimensions photo"
                    className="max-h-[min(58dvh,32rem)] max-w-full select-none object-contain"
                    draggable={false}
                  />
                </TransformComponent>
              </TransformWrapper>
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium tabular-nums text-white">
                {Math.round(zoom * 100)}%
              </div>
              <div className="absolute bottom-3 right-3 flex gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  disabled={zoom <= 1.02}
                  onClick={() => zoomRef.current?.zoomOut(0.35)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  disabled={zoom >= 7.9}
                  onClick={() => zoomRef.current?.zoomIn(0.35)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  disabled={zoom <= 1.02}
                  onClick={() => zoomRef.current?.resetTransform()}
                  title="Reset zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
          {lightbox ? (
            <div className="shrink-0 space-y-3 border-t bg-background px-4 py-3">
              <p className="text-sm font-medium tabular-nums text-foreground">
                {predictedDimsLine(lightbox)}
                {!lightbox.predictedVolume ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">no volume</span>
                ) : null}
              </p>
              {jevHintLine(lightbox) ? (
                <p className="text-xs text-muted-foreground" title={lightbox.jevReview?.reason ?? undefined}>
                  {jevHintLine(lightbox)}
                  {lightbox.predictedConfidence === "low" ? " · low confidence" : null}
                  {" — soft hint only; still rate Photo + Dims."}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1">
                  <span className="mr-1 self-center text-[10px] font-semibold uppercase text-muted-foreground">
                    Photo
                  </span>
                  <AspectTag
                    label="Good"
                    tone="good"
                    selected={lightbox.photoRating === "good"}
                    muted={Boolean(lightbox.photoRating) && lightbox.photoRating !== "good"}
                    disabled={busyId === lightbox.id || Boolean(lightbox.excludedAt)}
                    onClick={() => void rateAspect(lightbox, "photo", "good")}
                    solid
                  />
                  <AspectTag
                    label="Bad"
                    tone="bad"
                    selected={lightbox.photoRating === "bad"}
                    muted={Boolean(lightbox.photoRating) && lightbox.photoRating !== "bad"}
                    disabled={busyId === lightbox.id || Boolean(lightbox.excludedAt)}
                    onClick={() => void rateAspect(lightbox, "photo", "bad")}
                    solid
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className="mr-1 self-center text-[10px] font-semibold uppercase text-muted-foreground">
                    Dims
                  </span>
                  <AspectTag
                    label="Good"
                    tone="good"
                    selected={lightbox.dimsRating === "good"}
                    muted={Boolean(lightbox.dimsRating) && lightbox.dimsRating !== "good"}
                    disabled={busyId === lightbox.id || Boolean(lightbox.excludedAt)}
                    onClick={() => void rateAspect(lightbox, "dims", "good")}
                    solid
                  />
                  <AspectTag
                    label="Close"
                    tone="close"
                    selected={lightbox.dimsRating === "close"}
                    muted={Boolean(lightbox.dimsRating) && lightbox.dimsRating !== "close"}
                    disabled={busyId === lightbox.id || Boolean(lightbox.excludedAt)}
                    onClick={() => void rateAspect(lightbox, "dims", "close")}
                    solid
                  />
                  <AspectTag
                    label="Bad"
                    tone="bad"
                    selected={lightbox.dimsRating === "bad"}
                    muted={Boolean(lightbox.dimsRating) && lightbox.dimsRating !== "bad"}
                    disabled={busyId === lightbox.id || Boolean(lightbox.excludedAt)}
                    onClick={() => void rateAspect(lightbox, "dims", "bad")}
                    solid
                  />
                </div>
              </div>
              {!lightbox.excludedAt ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === lightbox.id}
                  onClick={() => void excludeMatch(lightbox)}
                >
                  Exclude — don’t match cases like this again
                </Button>
              ) : (
                <p className="text-xs font-medium text-slate-600">
                  Excluded — skipped on scan/rematch; similar images taught as skip.
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatAccuracyPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${Math.round(value * 100)}%`
}

function AccuracyCard({
  title,
  subtitle,
  accuracy,
  summary,
  target,
}: {
  title: string
  subtitle: string
  accuracy: number | null
  summary: string
  target: number
}) {
  const onTarget = accuracy != null && accuracy >= target
  const mid = accuracy != null && !onTarget && accuracy >= target * 0.75
  return (
    <div className="rounded-xl border bg-white px-3.5 py-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tabular-nums tracking-tight",
          accuracy == null && "text-muted-foreground",
          accuracy != null && onTarget && "text-emerald-600",
          mid && "text-amber-600",
          accuracy != null && !onTarget && !mid && "text-rose-600",
        )}
      >
        {formatAccuracyPct(accuracy)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
      {accuracy != null ? (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              onTarget ? "bg-emerald-500" : mid ? "bg-amber-400" : "bg-rose-400",
            )}
            style={{ width: `${Math.min(100, Math.round(accuracy * 100))}%` }}
          />
        </div>
      ) : (
        <div className="mt-2.5 h-1.5 rounded-full bg-slate-100" />
      )}
    </div>
  )
}

function AspectTag({
  label,
  tone,
  selected,
  muted,
  disabled,
  onClick,
  solid = false,
}: {
  label: string
  tone: AspectRating
  selected: boolean
  muted: boolean
  disabled?: boolean
  onClick: () => void
  solid?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
        selected &&
          tone === "good" &&
          "bg-emerald-500 text-white shadow-md ring-2 ring-emerald-200 scale-[1.03]",
        selected &&
          tone === "close" &&
          "bg-amber-500 text-white shadow-md ring-2 ring-amber-200 scale-[1.03]",
        selected &&
          tone === "bad" &&
          "bg-rose-500 text-white shadow-md ring-2 ring-rose-200 scale-[1.03]",
        muted && !selected && "bg-slate-100 text-slate-400 shadow-none ring-0",
        !selected &&
          !muted &&
          solid &&
          tone === "good" &&
          "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-500 hover:text-white",
        !selected &&
          !muted &&
          solid &&
          tone === "close" &&
          "border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-500 hover:text-white",
        !selected &&
          !muted &&
          solid &&
          tone === "bad" &&
          "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-500 hover:text-white",
        !selected &&
          !muted &&
          !solid &&
          tone === "good" &&
          "bg-white/90 text-emerald-800 shadow-sm backdrop-blur-sm hover:bg-emerald-500 hover:text-white",
        !selected &&
          !muted &&
          !solid &&
          tone === "close" &&
          "bg-white/90 text-amber-900 shadow-sm backdrop-blur-sm hover:bg-amber-500 hover:text-white",
        !selected &&
          !muted &&
          !solid &&
          tone === "bad" &&
          "bg-white/90 text-rose-800 shadow-sm backdrop-blur-sm hover:bg-rose-500 hover:text-white",
      )}
    >
      {label}
    </button>
  )
}

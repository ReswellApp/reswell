"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"

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
import { loadCatalogVolumeCorpusAction } from "@/lib/actions/catalogVolumeCalculatorAdmin"
import {
  isBoardLengthEntryComplete,
  normalizeBoardLengthInput,
  normalizeTapeStyleInchesInput,
  parseBoardMeasurement,
  totalBoardLengthInchesFromCombinedInput,
} from "@/lib/board-measurements"
import {
  estimateVolumeFromCatalogCalibration,
  evaluateCatalogVolumeLeaveOneOut,
  type CatalogVolumeAccuracyReport,
  type CatalogVolumeCalibrationPoint,
  type CatalogVolumeEstimateResult,
} from "@/lib/services/catalogCalibratedVolume"
import { cn } from "@/lib/utils"

type CorpusMeta = {
  rawRows: number
  parseSkipped: number
  brandCount: number
  modelCount: number
}

const ALL = "__all__"

function formatLiters(value: number): string {
  return value.toFixed(1)
}

export function CatalogVolumeCalculatorAdminClient() {
  const [points, setPoints] = useState<CatalogVolumeCalibrationPoint[]>([])
  const [meta, setMeta] = useState<CorpusMeta | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [boardLength, setBoardLength] = useState("6'0")
  const [boardWidthInches, setBoardWidthInches] = useState("19 1/2")
  const [boardThicknessInches, setBoardThicknessInches] = useState("2 1/2")
  const [brandId, setBrandId] = useState(ALL)
  const [modelId, setModelId] = useState(ALL)
  const [formError, setFormError] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<CatalogVolumeEstimateResult | null>(null)
  const [accuracy, setAccuracy] = useState<CatalogVolumeAccuracyReport | null>(null)
  const [accuracyPending, setAccuracyPending] = useState(false)

  const brands = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of points) map.set(p.brandId, p.brandName)
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [points])

  const models = useMemo(() => {
    const filtered =
      brandId === ALL ? points : points.filter((p) => p.brandId === brandId)
    const map = new Map<string, string>()
    for (const p of filtered) map.set(p.brandModelId, p.modelName)
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [points, brandId])

  function loadCorpus() {
    setLoadError(null)
    startTransition(async () => {
      const result = await loadCatalogVolumeCorpusAction()
      if (!result.ok) {
        setLoadError(result.error)
        setPoints([])
        setMeta(null)
        return
      }
      setPoints(result.corpus.points)
      setMeta({
        rawRows: result.corpus.rawRows,
        parseSkipped: result.corpus.parseSkipped,
        brandCount: result.corpus.brandCount,
        modelCount: result.corpus.modelCount,
      })
      setEstimate(null)
      setAccuracy(null)
    })
  }

  useEffect(() => {
    loadCorpus()
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [])

  function runEstimate() {
    if (!isBoardLengthEntryComplete(boardLength)) {
      setFormError("Enter a valid length (for example 6'2).")
      setEstimate(null)
      return
    }
    const lengthInches = totalBoardLengthInchesFromCombinedInput(boardLength)
    const widthInches =
      parseBoardMeasurement(boardWidthInches) ?? Number.parseFloat(boardWidthInches)
    const thicknessInches =
      parseBoardMeasurement(boardThicknessInches) ??
      Number.parseFloat(boardThicknessInches)

    if (lengthInches == null || !(widthInches > 0) || !(thicknessInches > 0)) {
      setFormError("Enter valid width and thickness in inches.")
      setEstimate(null)
      return
    }

    const selectedModel =
      modelId === ALL ? null : points.find((p) => p.brandModelId === modelId) ?? null
    const selectedBrandId = brandId === ALL ? null : brandId

    const result = estimateVolumeFromCatalogCalibration(
      { lengthInches, widthInches, thicknessInches },
      points,
      {
        k: 5,
        brandModelId: selectedModel?.brandModelId ?? null,
        brandId: selectedBrandId,
        boardCategorySlug: selectedModel?.boardCategorySlug ?? null,
      },
    )

    if (!result) {
      setFormError("No nearby stock sizes found in the calibration corpus.")
      setEstimate(null)
      return
    }

    setFormError(null)
    setEstimate(result)
  }

  function runAccuracyLab() {
    setAccuracyPending(true)
    // Yield so the spinner paints before the O(n²) leave-one-out pass.
    window.setTimeout(() => {
      const report = evaluateCatalogVolumeLeaveOneOut(points, {
        k: 5,
        sampleLimit: Math.min(points.length, 2500),
      })
      setAccuracy(report)
      setAccuracyPending(false)
    }, 30)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Catalog volume calculator
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Prototype: estimate custom-board liters from nearby stock variants in the brand
            catalog (same outline, slightly different dims). Leave-one-out accuracy shows how
            close the equation tracks known stock volumes.
          </p>
        </div>
        <Button type="button" variant="outline" disabled={pending} onClick={loadCorpus}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {points.length > 0 ? "Reload corpus" : "Load catalog corpus"}
        </Button>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-700">
          {loadError}
        </p>
      ) : null}

      {meta ? (
        <p className="text-sm text-muted-foreground">
          Loaded{" "}
          <span className="font-medium text-foreground tabular-nums">{points.length}</span>{" "}
          usable stock sizes from {meta.brandCount} brands / {meta.modelCount} models
          {meta.parseSkipped > 0 ? (
            <>
              {" "}
              · skipped {meta.parseSkipped} unparseable rows of {meta.rawRows}
            </>
          ) : null}
          . Public Guild calculator still lives at{" "}
          <Link href="/volume-calculator" className="underline underline-offset-4">
            /volume-calculator
          </Link>
          .
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Load the corpus to start testing. Requires admin access and catalog volume labels.
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Estimate a custom size</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Optionally lock to a brand/model so neighbors come from that outline first.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-vol-length">Length</Label>
            <Input
              id="admin-vol-length"
              value={boardLength}
              onChange={(e) => setBoardLength(normalizeBoardLengthInput(e.target.value))}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-vol-width">Width</Label>
            <Input
              id="admin-vol-width"
              value={boardWidthInches}
              onChange={(e) =>
                setBoardWidthInches(normalizeTapeStyleInchesInput(e.target.value))
              }
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-vol-thickness">Thickness</Label>
            <Input
              id="admin-vol-thickness"
              value={boardThicknessInches}
              onChange={(e) =>
                setBoardThicknessInches(normalizeTapeStyleInchesInput(e.target.value))
              }
              className="tabular-nums"
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Brand (optional)</Label>
            <Select
              value={brandId}
              onValueChange={(next) => {
                setBrandId(next)
                setModelId(ALL)
              }}
              disabled={points.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any brand</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Model (optional)</Label>
            <Select
              value={modelId}
              onValueChange={setModelId}
              disabled={points.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any model</SelectItem>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {formError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="mt-4">
          <Button type="button" disabled={points.length === 0} onClick={runEstimate}>
            Estimate volume
          </Button>
        </div>

        {estimate ? (
          <div className="mt-5 space-y-3 rounded-xl border border-foreground/10 bg-muted/30 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Estimated volume
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {formatLiters(estimate.litersDisplay)}
                <span className="ml-1 text-base font-medium text-muted-foreground">L</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Weighted shape factor {estimate.shapeFactor.toFixed(3)} · scope{" "}
                <span className="font-medium text-foreground">{estimate.scope}</span> ·{" "}
                {estimate.neighborCount} neighbors
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">Stock neighbor</th>
                    <th className="py-2 pr-3 font-medium">Dims</th>
                    <th className="py-2 pr-3 font-medium">Stock L</th>
                    <th className="py-2 pr-3 font-medium">SF</th>
                    <th className="py-2 pr-3 font-medium">Dist</th>
                    <th className="py-2 font-medium">Scaled L</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.neighbors.map((n) => (
                    <tr key={n.point.id} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        <span className="font-medium text-foreground">
                          {n.point.brandName} {n.point.modelName}
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                        {n.point.lengthLabel} × {n.point.widthLabel} × {n.point.thicknessLabel}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {formatLiters(n.point.volumeLiters)}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{n.point.shapeFactor.toFixed(3)}</td>
                      <td className="py-2 pr-3 tabular-nums">{n.distance.toFixed(2)}</td>
                      <td className="py-2 tabular-nums">
                        {formatLiters(n.estimatedFromNeighborLiters)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Accuracy lab (leave-one-out)</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Hide each stock size, estimate from remaining neighbors (prefer same model), compare
              to the known catalog liters.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={points.length < 2 || accuracyPending}
            onClick={runAccuracyLab}
          >
            {accuracyPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Run accuracy lab
          </Button>
        </div>

        {accuracy ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Sample size", value: String(accuracy.sampleSize) },
                {
                  label: "Median |error|",
                  value: `${formatLiters(accuracy.medianAbsErrorLiters)} L`,
                },
                {
                  label: "Mean |error|",
                  value: `${formatLiters(accuracy.meanAbsErrorLiters)} L`,
                },
                { label: "Mean % error", value: `${accuracy.meanPctError}%` },
                { label: "Within 0.5 L", value: `${accuracy.withinHalfLiterPct}%` },
                { label: "Within 1 L", value: `${accuracy.withinOneLiterPct}%` },
                { label: "Within 2 L", value: `${accuracy.withinTwoLitersPct}%` },
                { label: "Skipped", value: String(accuracy.skipped) },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border bg-background px-3 py-2"
                >
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Match scope counts — model {accuracy.byScope.model}, brand {accuracy.byScope.brand},
              category {accuracy.byScope.category}, global {accuracy.byScope.global}
            </p>

            <AccuracyTable title="Best matches" rows={accuracy.best} tone="good" />
            <AccuracyTable title="Worst misses" rows={accuracy.worst} tone="bad" />
          </div>
        ) : null}
      </section>
    </div>
  )
}

function AccuracyTable({
  title,
  rows,
  tone,
}: {
  title: string
  rows: CatalogVolumeAccuracyReport["best"]
  tone: "good" | "bad"
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pr-3 font-medium">Board</th>
              <th className="py-2 pr-3 font-medium">Known</th>
              <th className="py-2 pr-3 font-medium">Est.</th>
              <th className="py-2 pr-3 font-medium">Error</th>
              <th className="py-2 pr-3 font-medium">%</th>
              <th className="py-2 font-medium">Scope</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.point.id} className="border-b border-border/60">
                <td className="py-2 pr-3">
                  <span className="font-medium text-foreground">
                    {row.point.brandName} {row.point.modelName}
                  </span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {row.point.lengthLabel} × {row.point.widthLabel} × {row.point.thicknessLabel}
                  </span>
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {formatLiters(row.point.volumeLiters)} L
                </td>
                <td className="py-2 pr-3 tabular-nums">{formatLiters(row.estimatedLiters)} L</td>
                <td
                  className={cn(
                    "py-2 pr-3 tabular-nums font-medium",
                    tone === "good" ? "text-emerald-700" : "text-rose-700",
                  )}
                >
                  {row.errorLiters > 0 ? "+" : ""}
                  {formatLiters(row.errorLiters)} L
                </td>
                <td className="py-2 pr-3 tabular-nums">{row.pctError}%</td>
                <td className="py-2">{row.scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

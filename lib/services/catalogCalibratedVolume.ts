import { parseBoardMeasurement } from "@/lib/board-measurements"
import { parseBoardArchiveLengthInches, parseBoardArchiveVolumeLiters } from "@/lib/services/boardArchiveVariantMatch"
import { CUBIC_INCHES_TO_LITERS } from "@/lib/services/surfboardVolumeCalculator"

export type CatalogVolumeCalibrationPoint = {
  id: string
  brandId: string
  brandModelId: string
  brandName: string
  brandSlug: string
  modelName: string
  boardCategorySlug: string | null
  lengthLabel: string
  widthLabel: string
  thicknessLabel: string
  volumeLabel: string
  lengthInches: number
  widthInches: number
  thicknessInches: number
  volumeLiters: number
  /** Implied Guild factor from stock: V / (L×W×T×0.016387). */
  shapeFactor: number
}

export type CatalogVolumeQueryDims = {
  lengthInches: number
  widthInches: number
  thicknessInches: number
}

export type CatalogVolumeMatchScope = "model" | "brand" | "category" | "global"

export type CatalogVolumeNeighbor = {
  point: CatalogVolumeCalibrationPoint
  distance: number
  weight: number
  estimatedFromNeighborLiters: number
}

export type CatalogVolumeEstimateResult = {
  liters: number
  litersDisplay: number
  shapeFactor: number
  scope: CatalogVolumeMatchScope
  neighborCount: number
  neighbors: CatalogVolumeNeighbor[]
  method: "weighted-shape-factor"
}

export type CatalogVolumeLeaveOneOutRow = {
  point: CatalogVolumeCalibrationPoint
  estimatedLiters: number
  errorLiters: number
  absErrorLiters: number
  pctError: number
  scope: CatalogVolumeMatchScope
  neighborCount: number
}

export type CatalogVolumeAccuracyReport = {
  sampleSize: number
  skipped: number
  meanAbsErrorLiters: number
  medianAbsErrorLiters: number
  meanPctError: number
  withinHalfLiterPct: number
  withinOneLiterPct: number
  withinTwoLitersPct: number
  best: CatalogVolumeLeaveOneOutRow[]
  worst: CatalogVolumeLeaveOneOutRow[]
  byScope: Record<CatalogVolumeMatchScope, number>
}

export type CatalogVolumeEstimateOptions = {
  k?: number
  /** Prefer neighbors from this model when present. */
  brandModelId?: string | null
  brandId?: string | null
  boardCategorySlug?: string | null
  /** Soft gate: ignore neighbors farther than this normalized distance. */
  maxDistance?: number
}

const DEFAULT_K = 5
const DEFAULT_MAX_DISTANCE = 8

function roundLiters(value: number): number {
  return Math.round(value * 10) / 10
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2
  }
  return sorted[mid]!
}

/** Parse catalog width/thickness labels (`19 1/2`, `2.5`, `2 3/8"`). */
export function parseCatalogInchLabel(label: string | null | undefined): number | null {
  const raw = label?.trim() ?? ""
  if (!raw) return null
  const cleaned = raw.replace(/["″]/gu, "").trim()
  const parsed = parseBoardMeasurement(cleaned) ?? Number.parseFloat(cleaned.replace(/,/g, ""))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function impliedShapeFactor(input: CatalogVolumeQueryDims & { volumeLiters: number }): number | null {
  const box = input.lengthInches * input.widthInches * input.thicknessInches
  if (!(box > 0) || !(input.volumeLiters > 0)) return null
  const sf = input.volumeLiters / (box * CUBIC_INCHES_TO_LITERS)
  return Number.isFinite(sf) && sf > 0 ? sf : null
}

export function volumeFromShapeFactor(
  dims: CatalogVolumeQueryDims,
  shapeFactor: number,
): number {
  return dims.lengthInches * dims.widthInches * dims.thicknessInches * shapeFactor * CUBIC_INCHES_TO_LITERS
}

/**
 * Scale stock volume by dim ratios (same outline assumption).
 * Equivalent to applying that stock's implied shape factor to the query dims.
 */
export function scaleStockVolumeToDims(
  stock: CatalogVolumeCalibrationPoint,
  dims: CatalogVolumeQueryDims,
): number {
  return (
    stock.volumeLiters *
    (dims.lengthInches / stock.lengthInches) *
    (dims.widthInches / stock.widthInches) *
    (dims.thicknessInches / stock.thicknessInches)
  )
}

/**
 * Normalized distance in L/W/T space.
 * Length scaled by ~2", width by ~0.5", thickness by ~0.25" so each axis is comparable.
 */
export function catalogDimensionDistance(
  a: CatalogVolumeQueryDims,
  b: CatalogVolumeQueryDims,
): number {
  const dL = (a.lengthInches - b.lengthInches) / 2
  const dW = (a.widthInches - b.widthInches) / 0.5
  const dT = (a.thicknessInches - b.thicknessInches) / 0.25
  return Math.sqrt(dL * dL + dW * dW + dT * dT)
}

function filterCorpus(
  corpus: readonly CatalogVolumeCalibrationPoint[],
  opts: CatalogVolumeEstimateOptions,
): { points: CatalogVolumeCalibrationPoint[]; scope: CatalogVolumeMatchScope } {
  const modelId = opts.brandModelId?.trim() || null
  const brandId = opts.brandId?.trim() || null
  const category = opts.boardCategorySlug?.trim() || null

  if (modelId) {
    const byModel = corpus.filter((p) => p.brandModelId === modelId)
    if (byModel.length > 0) return { points: byModel, scope: "model" }
  }

  if (brandId) {
    let byBrand = corpus.filter((p) => p.brandId === brandId)
    if (category) {
      const byBrandCategory = byBrand.filter((p) => p.boardCategorySlug === category)
      if (byBrandCategory.length > 0) byBrand = byBrandCategory
    }
    if (byBrand.length > 0) return { points: byBrand, scope: "brand" }
  }

  if (category) {
    const byCategory = corpus.filter((p) => p.boardCategorySlug === category)
    if (byCategory.length > 0) return { points: byCategory, scope: "category" }
  }

  return { points: [...corpus], scope: "global" }
}

export function estimateVolumeFromCatalogCalibration(
  dims: CatalogVolumeQueryDims,
  corpus: readonly CatalogVolumeCalibrationPoint[],
  opts: CatalogVolumeEstimateOptions = {},
): CatalogVolumeEstimateResult | null {
  const k = opts.k ?? DEFAULT_K
  const maxDistance = opts.maxDistance ?? DEFAULT_MAX_DISTANCE
  const { points, scope } = filterCorpus(corpus, opts)
  if (points.length === 0) return null

  const ranked = points
    .map((point) => {
      const distance = catalogDimensionDistance(dims, point)
      const estimatedFromNeighborLiters = scaleStockVolumeToDims(point, dims)
      return { point, distance, estimatedFromNeighborLiters }
    })
    .filter((row) => row.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.max(1, k))

  if (ranked.length === 0) return null

  const neighbors: CatalogVolumeNeighbor[] = ranked.map((row) => ({
    ...row,
    weight: 1 / (row.distance + 0.05),
  }))

  const weightSum = neighbors.reduce((sum, n) => sum + n.weight, 0)
  const shapeFactor =
    neighbors.reduce((sum, n) => sum + n.point.shapeFactor * n.weight, 0) / weightSum
  const liters = volumeFromShapeFactor(dims, shapeFactor)

  return {
    liters,
    litersDisplay: roundLiters(liters),
    shapeFactor: Math.round(shapeFactor * 1000) / 1000,
    scope,
    neighborCount: neighbors.length,
    neighbors,
    method: "weighted-shape-factor",
  }
}

/**
 * Leave-one-out: hide each stock size, estimate from remaining neighbors, compare to known liters.
 * Prefer same-model neighbors so the prototype measures “custom near this model.”
 */
export function evaluateCatalogVolumeLeaveOneOut(
  corpus: readonly CatalogVolumeCalibrationPoint[],
  opts: { k?: number; maxDistance?: number; sampleLimit?: number } = {},
): CatalogVolumeAccuracyReport {
  const rows: CatalogVolumeLeaveOneOutRow[] = []
  let skipped = 0
  const byScope: Record<CatalogVolumeMatchScope, number> = {
    model: 0,
    brand: 0,
    category: 0,
    global: 0,
  }

  const sampleLimit = opts.sampleLimit ?? corpus.length
  const sample = corpus.slice(0, sampleLimit)

  for (const point of sample) {
    const rest = corpus.filter((p) => p.id !== point.id)
    const estimate = estimateVolumeFromCatalogCalibration(
      {
        lengthInches: point.lengthInches,
        widthInches: point.widthInches,
        thicknessInches: point.thicknessInches,
      },
      rest,
      {
        k: opts.k,
        maxDistance: opts.maxDistance,
        brandModelId: point.brandModelId,
        brandId: point.brandId,
        boardCategorySlug: point.boardCategorySlug,
      },
    )

    if (!estimate) {
      skipped += 1
      continue
    }

    const errorLiters = estimate.litersDisplay - point.volumeLiters
    const absErrorLiters = Math.abs(errorLiters)
    const pctError = point.volumeLiters > 0 ? (absErrorLiters / point.volumeLiters) * 100 : 0
    byScope[estimate.scope] += 1
    rows.push({
      point,
      estimatedLiters: estimate.litersDisplay,
      errorLiters: roundLiters(errorLiters),
      absErrorLiters: roundLiters(absErrorLiters),
      pctError: Math.round(pctError * 10) / 10,
      scope: estimate.scope,
      neighborCount: estimate.neighborCount,
    })
  }

  const absErrors = rows.map((r) => r.absErrorLiters)
  const pctErrors = rows.map((r) => r.pctError)
  const meanAbs =
    absErrors.length === 0 ? 0 : absErrors.reduce((a, b) => a + b, 0) / absErrors.length
  const meanPct =
    pctErrors.length === 0 ? 0 : pctErrors.reduce((a, b) => a + b, 0) / pctErrors.length

  const sortedByAbs = [...rows].sort((a, b) => a.absErrorLiters - b.absErrorLiters)

  return {
    sampleSize: rows.length,
    skipped,
    meanAbsErrorLiters: roundLiters(meanAbs),
    medianAbsErrorLiters: roundLiters(median(absErrors)),
    meanPctError: Math.round(meanPct * 10) / 10,
    withinHalfLiterPct:
      rows.length === 0
        ? 0
        : Math.round((rows.filter((r) => r.absErrorLiters <= 0.5).length / rows.length) * 1000) / 10,
    withinOneLiterPct:
      rows.length === 0
        ? 0
        : Math.round((rows.filter((r) => r.absErrorLiters <= 1).length / rows.length) * 1000) / 10,
    withinTwoLitersPct:
      rows.length === 0
        ? 0
        : Math.round((rows.filter((r) => r.absErrorLiters <= 2).length / rows.length) * 1000) / 10,
    best: sortedByAbs.slice(0, 8),
    worst: [...sortedByAbs].reverse().slice(0, 8),
    byScope,
  }
}

export function catalogPointFromLabels(input: {
  id: string
  brandId: string
  brandModelId: string
  brandName: string
  brandSlug: string
  modelName: string
  boardCategorySlug: string | null
  lengthLabel: string
  widthLabel: string
  thicknessLabel: string
  volumeLabel: string
}): CatalogVolumeCalibrationPoint | null {
  const lengthInches = parseBoardArchiveLengthInches(input.lengthLabel)
  const widthInches = parseCatalogInchLabel(input.widthLabel)
  const thicknessInches = parseCatalogInchLabel(input.thicknessLabel)
  const volumeLiters = parseBoardArchiveVolumeLiters(input.volumeLabel)
  if (
    lengthInches == null ||
    widthInches == null ||
    thicknessInches == null ||
    volumeLiters == null
  ) {
    return null
  }
  const shapeFactor = impliedShapeFactor({
    lengthInches,
    widthInches,
    thicknessInches,
    volumeLiters,
  })
  if (shapeFactor == null) return null

  return {
    id: input.id,
    brandId: input.brandId,
    brandModelId: input.brandModelId,
    brandName: input.brandName,
    brandSlug: input.brandSlug,
    modelName: input.modelName,
    boardCategorySlug: input.boardCategorySlug,
    lengthLabel: input.lengthLabel,
    widthLabel: input.widthLabel,
    thicknessLabel: input.thicknessLabel,
    volumeLabel: input.volumeLabel,
    lengthInches,
    widthInches,
    thicknessInches,
    volumeLiters,
    shapeFactor: Math.round(shapeFactor * 1000) / 1000,
  }
}

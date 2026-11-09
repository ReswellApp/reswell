import type { SupabaseClient } from "@supabase/supabase-js"

import { listSurfboardVolumeCalibrationRows } from "@/lib/db/catalogVolumeCalibration"
import {
  catalogPointFromLabels,
  evaluateCatalogVolumeLeaveOneOut,
  estimateVolumeFromCatalogCalibration,
  type CatalogVolumeAccuracyReport,
  type CatalogVolumeCalibrationPoint,
  type CatalogVolumeEstimateResult,
  type CatalogVolumeQueryDims,
} from "@/lib/services/catalogCalibratedVolume"
import { requireAdmin } from "@/lib/brands/admin-server"

export type CatalogVolumeCalibrationCorpus = {
  points: CatalogVolumeCalibrationPoint[]
  rawRows: number
  parseSkipped: number
  brandCount: number
  modelCount: number
}

export async function loadCatalogVolumeCalibrationCorpus(
  supabase: SupabaseClient,
): Promise<CatalogVolumeCalibrationCorpus> {
  const rows = await listSurfboardVolumeCalibrationRows(supabase)
  const points: CatalogVolumeCalibrationPoint[] = []
  let parseSkipped = 0

  for (const row of rows) {
    const point = catalogPointFromLabels({
      id: row.id,
      brandId: row.brand_id,
      brandModelId: row.brand_model_id,
      brandName: row.brand_name,
      brandSlug: row.brand_slug,
      modelName: row.model_name,
      boardCategorySlug: row.board_category_slug,
      lengthLabel: row.length_label,
      widthLabel: row.width_label,
      thicknessLabel: row.thickness_label,
      volumeLabel: row.volume_label,
    })
    if (!point) {
      parseSkipped += 1
      continue
    }
    points.push(point)
  }

  return {
    points,
    rawRows: rows.length,
    parseSkipped,
    brandCount: new Set(points.map((p) => p.brandId)).size,
    modelCount: new Set(points.map((p) => p.brandModelId)).size,
  }
}

export async function getCatalogVolumeCalibrationCorpusForAdmin(): Promise<
  | { ok: true; corpus: CatalogVolumeCalibrationCorpus }
  | { ok: false; error: string }
> {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return { ok: false, error: gate.response.status === 401 ? "Sign in required" : "Admin only" }
  }
  const corpus = await loadCatalogVolumeCalibrationCorpus(gate.ctx.supabase)
  return { ok: true, corpus }
}

export function estimateCustomVolumeAgainstCorpus(
  dims: CatalogVolumeQueryDims,
  corpus: readonly CatalogVolumeCalibrationPoint[],
  opts: {
    brandModelId?: string | null
    brandId?: string | null
    boardCategorySlug?: string | null
    k?: number
  },
): CatalogVolumeEstimateResult | null {
  return estimateVolumeFromCatalogCalibration(dims, corpus, opts)
}

export function runCatalogVolumeAccuracyLab(
  corpus: readonly CatalogVolumeCalibrationPoint[],
  opts?: { k?: number; sampleLimit?: number },
): CatalogVolumeAccuracyReport {
  return evaluateCatalogVolumeLeaveOneOut(corpus, opts)
}

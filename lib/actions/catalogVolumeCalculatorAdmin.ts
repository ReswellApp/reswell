"use server"

import {
  getCatalogVolumeCalibrationCorpusForAdmin,
  type CatalogVolumeCalibrationCorpus,
} from "@/lib/services/catalogCalibratedVolumeAdmin"

export type CatalogVolumeCorpusActionResult =
  | { ok: true; corpus: CatalogVolumeCalibrationCorpus }
  | { ok: false; error: string }

export async function loadCatalogVolumeCorpusAction(): Promise<CatalogVolumeCorpusActionResult> {
  return getCatalogVolumeCalibrationCorpusForAdmin()
}

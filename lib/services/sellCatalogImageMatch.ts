/**
 * Admin `/sell` photo matcher: vision extract → catalog retrieval.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { searchSellCatalogForSell } from "@/lib/services/sellCatalogSearch"
import {
  isSellCatalogImageScanEnabled,
  understandSellCatalogImage,
  type SellCatalogScanImageInput,
} from "@/lib/services/sellCatalogImageUnderstand"
import type { SellCatalogImageScanResult } from "@/lib/types/sell-catalog-image-scan"
import {
  buildSellCatalogImageScanLookup,
  resolveSellCatalogImageScanCategories,
} from "@/lib/utils/sell-catalog-image-scan"

const MAX_SCAN_ROWS = 12

export class SellCatalogImageScanDisabledError extends Error {
  constructor() {
    super("Image matching is not enabled.")
    this.name = "SellCatalogImageScanDisabledError"
  }
}

export class SellCatalogImageScanReadError extends Error {
  constructor() {
    super("Could not read that photo. Try another angle with the logo or model name in frame.")
    this.name = "SellCatalogImageScanReadError"
  }
}

export async function runSellCatalogImageMatch(
  supabase: SupabaseClient,
  image: SellCatalogScanImageInput,
): Promise<SellCatalogImageScanResult> {
  if (!isSellCatalogImageScanEnabled()) {
    throw new SellCatalogImageScanDisabledError()
  }

  const extract = await understandSellCatalogImage(image)
  if (!extract) {
    throw new SellCatalogImageScanReadError()
  }

  const lookup = buildSellCatalogImageScanLookup(extract)
  if (lookup.length < 2) {
    return {
      extract,
      lookup: "",
      matchTier: "none",
      rows: [],
    }
  }

  const categories = resolveSellCatalogImageScanCategories(extract)
  const result = await searchSellCatalogForSell(supabase, lookup, { categories })
  const rows = (
    result.results.length > 0 ? result.results : result.similarResults
  ).slice(0, MAX_SCAN_ROWS)

  return {
    extract,
    lookup,
    matchTier: rows.length > 0 ? result.meta.matchTier : "none",
    rows,
  }
}

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyListingBrandModelAttach,
  collectActiveSurfboardListingsNeedingBrandOrModel,
  loadBrandModelsByBrandId,
  loadDirectoryBrandsForMatching,
  recordListingBrandModelAutofill,
  type ListingBrandModelPatch,
} from "@/lib/db/listingBrandModelBackfill"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { matchBrandFromTitle, matchModelFromTitle } from "@/lib/utils/listing-brand-model-match"

export type ListingBrandModelBackfillSummary = {
  scanned: number
  brand_attached: number
  model_attached: number
  unmatched: number
  errors: number
  /** True when more listings still need processing than this run covered. */
  capped: boolean
  error_samples: Array<{ listingId: string; error: string }>
}

/**
 * Bounded per run so the cron stays within the function time budget; remaining
 * listings are processed on subsequent daily runs (oldest first).
 */
const DEFAULT_MAX_LISTINGS_PER_RUN = 500
const MAX_ERROR_SAMPLES = 10

/**
 * Backfill catalog brand/model links on active surfboard listings.
 *
 * For each active listing missing `brand_id` and/or `brand_model_id`, the title is
 * matched (whole-word, high precision) against the directory brand catalog, and —
 * scoped to the matched/existing brand — against that brand's `brand_models`. Any
 * confident match is written to the listing (FK + canonical label) and the listing
 * is re-synced to Elasticsearch so the new brand/model is searchable. Existing
 * links are never overwritten.
 */
export async function runListingBrandModelBackfill(
  supabase: SupabaseClient,
  options?: { maxListings?: number },
): Promise<ListingBrandModelBackfillSummary> {
  const maxListings = Math.max(1, options?.maxListings ?? DEFAULT_MAX_LISTINGS_PER_RUN)

  const summary: ListingBrandModelBackfillSummary = {
    scanned: 0,
    brand_attached: 0,
    model_attached: 0,
    unmatched: 0,
    errors: 0,
    capped: false,
    error_samples: [],
  }

  const { rows, capped } = await collectActiveSurfboardListingsNeedingBrandOrModel(
    supabase,
    maxListings,
  )
  summary.capped = capped
  if (rows.length === 0) return summary

  const brands = await loadDirectoryBrandsForMatching(supabase)
  const modelsByBrand = await loadBrandModelsByBrandId(supabase)

  for (const row of rows) {
    summary.scanned += 1

    try {
      const patch: ListingBrandModelPatch = {}

      let effectiveBrandId = row.brand_id
      if (!effectiveBrandId) {
        const brand = matchBrandFromTitle(row.title, brands)
        if (brand) {
          patch.brand_id = brand.id
          patch.brand = brand.name
          effectiveBrandId = brand.id
        }
      }

      if (!row.brand_model_id && effectiveBrandId) {
        const models = modelsByBrand.get(effectiveBrandId) ?? []
        const model = matchModelFromTitle(row.title, models)
        if (model) {
          patch.brand_model_id = model.id
          patch.model = model.name
        }
      }

      if (!patch.brand_id && !patch.brand_model_id) {
        summary.unmatched += 1
        continue
      }

      const result = await applyListingBrandModelAttach(supabase, row.id, patch)
      if (!result.ok) {
        summary.errors += 1
        if (summary.error_samples.length < MAX_ERROR_SAMPLES) {
          summary.error_samples.push({ listingId: row.id, error: result.message })
        }
        continue
      }

      if (patch.brand_id) summary.brand_attached += 1
      if (patch.brand_model_id) summary.model_attached += 1

      // Audit trail so admins can cross-verify what the cron attached.
      await recordListingBrandModelAutofill(supabase, {
        listing_id: row.id,
        listing_title: row.title,
        brand_id: patch.brand_id ?? null,
        brand_name: patch.brand ?? null,
        brand_model_id: patch.brand_model_id ?? null,
        model_name: patch.model ?? null,
        attached_brand: Boolean(patch.brand_id),
        attached_model: Boolean(patch.brand_model_id),
      })

      // Best-effort: keep the search index in step with the new brand/model labels.
      await syncListingToIndex(supabase, row.id).catch((e) => {
        console.error("[listing-brand-model-backfill] ES re-sync failed", {
          listingId: row.id,
          error: e instanceof Error ? e.message : String(e),
        })
      })
    } catch (e) {
      summary.errors += 1
      if (summary.error_samples.length < MAX_ERROR_SAMPLES) {
        summary.error_samples.push({
          listingId: row.id,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  return summary
}

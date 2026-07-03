import type { SupabaseClient } from "@supabase/supabase-js"
import { FIN_CATALOG_PRODUCT_CATEGORY } from "@/lib/brand-catalog-fin-variants"
import {
  applyListingBrandModelAttach,
  clearListingBrandModelUnmatched,
  collectActiveListingsNeedingBrandOrModel,
  loadBrandModelsByBrandId,
  loadBrandModelsByBrandIdForProductCategory,
  loadDirectoryBrandsForMatching,
  loadFinDirectoryBrandsForMatching,
  recordListingBrandModelAutofill,
  upsertListingBrandModelUnmatched,
  type BackfillListingRow,
  type ListingBrandModelBackfillSection,
  type ListingBrandModelPatch,
} from "@/lib/db/listingBrandModelBackfill"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import {
  matchBrandFromTitle,
  matchModelFromTitle,
  type BrandMatchRow,
  type ModelMatchRow,
} from "@/lib/utils/listing-brand-model-match"

export type ListingBrandModelBackfillSectionSummary = {
  scanned: number
  brand_attached: number
  model_attached: number
  unmatched: number
  capped: boolean
}

export type ListingBrandModelBackfillSummary = {
  scanned: number
  brand_attached: number
  model_attached: number
  unmatched: number
  errors: number
  /** True when more listings still need processing than this run covered. */
  capped: boolean
  by_section: Record<ListingBrandModelBackfillSection, ListingBrandModelBackfillSectionSummary>
  error_samples: Array<{ listingId: string; error: string }>
}

/**
 * Bounded per section per run so the cron stays within the function time budget;
 * remaining listings are processed on subsequent daily runs (oldest first).
 */
const DEFAULT_MAX_LISTINGS_PER_SECTION_PER_RUN = 250
const MAX_ERROR_SAMPLES = 10

type SectionCatalog = {
  brands: BrandMatchRow[]
  modelsByBrand: Map<string, ModelMatchRow[]>
}

function emptySectionSummary(): ListingBrandModelBackfillSectionSummary {
  return {
    scanned: 0,
    brand_attached: 0,
    model_attached: 0,
    unmatched: 0,
    capped: false,
  }
}

async function loadSectionCatalog(
  supabase: SupabaseClient,
  section: ListingBrandModelBackfillSection,
): Promise<SectionCatalog> {
  if (section === "fins") {
    const [brands, modelsByBrand] = await Promise.all([
      loadFinDirectoryBrandsForMatching(supabase),
      loadBrandModelsByBrandIdForProductCategory(supabase, FIN_CATALOG_PRODUCT_CATEGORY),
    ])
    return { brands, modelsByBrand }
  }

  const [brands, modelsByBrand] = await Promise.all([
    loadDirectoryBrandsForMatching(supabase),
    loadBrandModelsByBrandId(supabase),
  ])
  return { brands, modelsByBrand }
}

async function processSectionListings(
  supabase: SupabaseClient,
  rows: BackfillListingRow[],
  catalog: SectionCatalog,
  summary: ListingBrandModelBackfillSummary,
  sectionSummary: ListingBrandModelBackfillSectionSummary,
): Promise<void> {
  for (const row of rows) {
    summary.scanned += 1
    sectionSummary.scanned += 1

    try {
      const patch: ListingBrandModelPatch = {}

      let effectiveBrandId = row.brand_id
      let effectiveBrandName = row.brand?.trim() || null
      if (!effectiveBrandId) {
        const brand = matchBrandFromTitle(row.title, catalog.brands)
        if (brand) {
          patch.brand_id = brand.id
          patch.brand = brand.name
          effectiveBrandId = brand.id
          effectiveBrandName = brand.name
        }
      }

      if (!row.brand_model_id && effectiveBrandId) {
        const models = catalog.modelsByBrand.get(effectiveBrandId) ?? []
        const model = matchModelFromTitle(row.title, models)
        if (model) {
          patch.brand_model_id = model.id
          patch.model = model.name
        }
      }

      const attachedSomething = Boolean(patch.brand_id || patch.brand_model_id)
      if (attachedSomething) {
        const result = await applyListingBrandModelAttach(supabase, row.id, patch)
        if (!result.ok) {
          summary.errors += 1
          if (summary.error_samples.length < MAX_ERROR_SAMPLES) {
            summary.error_samples.push({ listingId: row.id, error: result.message })
          }
          continue
        }

        if (patch.brand_id) {
          summary.brand_attached += 1
          sectionSummary.brand_attached += 1
        }
        if (patch.brand_model_id) {
          summary.model_attached += 1
          sectionSummary.model_attached += 1
        }

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

        await syncListingToIndex(supabase, row.id).catch((e) => {
          console.error("[listing-brand-model-backfill] ES re-sync failed", {
            listingId: row.id,
            error: e instanceof Error ? e.message : String(e),
          })
        })
      } else {
        summary.unmatched += 1
        sectionSummary.unmatched += 1
      }

      const stillNeedsBrand = !row.brand_id && !patch.brand_id
      const stillNeedsModel = !row.brand_model_id && !patch.brand_model_id
      if (stillNeedsBrand || stillNeedsModel) {
        await upsertListingBrandModelUnmatched(supabase, {
          listing_id: row.id,
          listing_title: row.title,
          needs_brand: stillNeedsBrand,
          needs_model: stillNeedsModel,
          matched_brand_id: stillNeedsModel ? effectiveBrandId : null,
          matched_brand_name: stillNeedsModel ? effectiveBrandName : null,
        })
      } else {
        await clearListingBrandModelUnmatched(supabase, row.id)
      }
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
}

/**
 * Backfill catalog brand/model links on active surfboard and fin listings.
 *
 * For each active listing missing `brand_id` and/or `brand_model_id`, the title is
 * matched (whole-word, high precision) against the directory brand catalog, and —
 * scoped to the matched/existing brand — against that brand's `brand_models`. Fin
 * listings use fin-tagged brands and fin catalog models only. Existing links are
 * never overwritten.
 */
export async function runListingBrandModelBackfill(
  supabase: SupabaseClient,
  options?: { maxListingsPerSection?: number },
): Promise<ListingBrandModelBackfillSummary> {
  const maxPerSection = Math.max(
    1,
    options?.maxListingsPerSection ?? DEFAULT_MAX_LISTINGS_PER_SECTION_PER_RUN,
  )

  const summary: ListingBrandModelBackfillSummary = {
    scanned: 0,
    brand_attached: 0,
    model_attached: 0,
    unmatched: 0,
    errors: 0,
    capped: false,
    by_section: {
      surfboards: emptySectionSummary(),
      fins: emptySectionSummary(),
    },
    error_samples: [],
  }

  const sections: ListingBrandModelBackfillSection[] = ["surfboards", "fins"]

  const [surfboardBatch, finBatch, surfboardCatalog, finCatalog] = await Promise.all([
    collectActiveListingsNeedingBrandOrModel(supabase, "surfboards", maxPerSection),
    collectActiveListingsNeedingBrandOrModel(supabase, "fins", maxPerSection),
    loadSectionCatalog(supabase, "surfboards"),
    loadSectionCatalog(supabase, "fins"),
  ])

  summary.by_section.surfboards.capped = surfboardBatch.capped
  summary.by_section.fins.capped = finBatch.capped
  summary.capped = surfboardBatch.capped || finBatch.capped

  if (surfboardBatch.rows.length > 0) {
    await processSectionListings(
      supabase,
      surfboardBatch.rows,
      surfboardCatalog,
      summary,
      summary.by_section.surfboards,
    )
  }

  if (finBatch.rows.length > 0) {
    await processSectionListings(
      supabase,
      finBatch.rows,
      finCatalog,
      summary,
      summary.by_section.fins,
    )
  }

  return summary
}

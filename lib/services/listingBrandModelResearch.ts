import type { SupabaseClient } from "@supabase/supabase-js"
import { generateText, Output } from "ai"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import {
  applyListingBrandModelAttach,
  clearListingBrandModelUnmatched,
  getDirectoryBrandProfile,
  listUnmatchedListingsForResearch,
  recordListingBrandModelAutofill,
  upsertListingBrandModelUnmatched,
  type BackfillListingRow,
  type ListingBrandModelBackfillSection,
  type ListingBrandModelPatch,
} from "@/lib/db/listingBrandModelBackfill"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import {
  ensureDirectoryBrandForListingCoverage,
  ensureDirectoryModelForListingCoverage,
} from "@/lib/services/listingBrandCatalogEnsure"
import { extractListingBrandModelCandidates } from "@/lib/utils/listing-brand-model-candidates"
import {
  matchBrandFromLabel,
  matchModelFromLabel,
  type BrandMatchRow,
  type ModelMatchRow,
} from "@/lib/utils/listing-brand-model-match"
import {
  isSafePublicHttpsUrl,
  officialSiteTextMentionsModel,
} from "@/lib/utils/listing-brand-model-official-site"
import {
  decideListingBrandModelCatalogCreate,
  type OfficialSiteVerification,
} from "@/lib/utils/listing-brand-model-research-decision"
import {
  listingBrandModelResearchResultSchema,
  type ListingBrandModelResearchResult,
} from "@/lib/validations/listing-brand-model-research"

const RESEARCH_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
const OFFICIAL_SITE_TIMEOUT_MS = 8000
const DEFAULT_MAX_RESEARCH_PER_RUN = 12

export type ListingBrandModelResearchSummary = {
  attempted: number
  brand_created: number
  model_created: number
  attached: number
  queued_for_review: number
  skipped: number
  errors: number
}

type SectionCatalog = {
  brands: BrandMatchRow[]
  modelsByBrand: Map<string, ModelMatchRow[]>
}

function researchFeature() {
  const feature = APP_LLM_FEATURES.find((f) => f.id === "listing_brand_model_research")
  if (!feature) {
    throw new Error("listing_brand_model_research is missing from APP_LLM_FEATURES")
  }
  return feature
}

export function isListingBrandModelResearchEnabled(): boolean {
  return isAppLlmFeatureEnabled(researchFeature())
}

function emptyResearchSummary(): ListingBrandModelResearchSummary {
  return {
    attempted: 0,
    brand_created: 0,
    model_created: 0,
    attached: 0,
    queued_for_review: 0,
    skipped: 0,
    errors: 0,
  }
}

function productCategoryForSection(
  section: ListingBrandModelBackfillSection,
): BrandProductCategorySlug {
  return section === "fins" ? "fins" : "surfboards"
}

async function researchListingWithLlm(input: {
  title: string | null
  brand: string | null
  model: string | null
  section: ListingBrandModelBackfillSection
}): Promise<ListingBrandModelResearchResult | null> {
  if (!isListingBrandModelResearchEnabled()) return null

  const feature = researchFeature()
  try {
    const { output } = await generateText({
      model: resolveConfiguredModel(feature),
      output: Output.object({ schema: listingBrandModelResearchResultSchema }),
      system: `You research surf marketplace listings for Reswell's brand/model catalog.

Rules:
- Never invent a brand or model the listing did not name.
- Official source only: the shaper's own website. Never use retailers (Surfline, CCS, Amazon), Instagram, Facebook, TikTok, or Wikipedia as the official_website_url.
- Named production models only. Skip Custom, ding repair, deposits, one-offs, and dimension-only SKUs (5'6 EPS).
- Surfboards section: surfboard shapers only. Fins section: fin manufacturers only. Skip apparel, wetsuits, SUPs, foil, merch.
- confidence is "high" only when you would add this row to a production catalog today.
- is_real_shaper is true only for an independent shaper or known surfboard/fin manufacturer.
- is_category_match must match the listing section.
- If anything is unclear, set confidence to "low" and a skip_reason.`,
      prompt: `Listing section: ${input.section}
Title: ${input.title ?? ""}
Seller brand field: ${input.brand ?? ""}
Seller model field: ${input.model ?? ""}

Return structured research. If you cannot confirm a real official site and named model, keep confidence low.`,
      temperature: 0,
      providerOptions: {
        gateway: {
          tags: gatewayTagsForFeature("listing_brand_model_research"),
        },
      },
    })

    if (!output) return null
    return listingBrandModelResearchResultSchema.parse(output)
  } catch (err) {
    console.error("[listingBrandModelResearch] LLM failed:", err)
    return null
  }
}

async function verifyOfficialSite(
  websiteUrl: string | null,
  modelName: string | null,
): Promise<OfficialSiteVerification> {
  if (!websiteUrl || !isSafePublicHttpsUrl(websiteUrl)) {
    return {
      ok: false,
      blocked: Boolean(websiteUrl) && !isSafePublicHttpsUrl(websiteUrl),
      fetchFailed: false,
      modelMentioned: false,
      host: null,
    }
  }

  const host = (() => {
    try {
      return new URL(websiteUrl).hostname.toLowerCase()
    } catch {
      return null
    }
  })()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OFFICIAL_SITE_TIMEOUT_MS)
  try {
    const res = await fetch(websiteUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
    })
    if (!res.ok) {
      return { ok: false, blocked: false, fetchFailed: true, modelMentioned: false, host }
    }

    const contentType = res.headers.get("content-type") ?? ""
    const body = await res.text()
    const htmlOk = contentType.includes("html") || contentType.includes("json") || body.length > 200
    if (!htmlOk) {
      return { ok: false, blocked: false, fetchFailed: true, modelMentioned: false, host }
    }

    let modelMentioned = modelName ? officialSiteTextMentionsModel(body, modelName) : false

    if (!modelMentioned && modelName && host) {
      modelMentioned = await shopifyProductsMentionModel(websiteUrl, modelName, controller.signal)
    }

    return {
      ok: true,
      blocked: false,
      fetchFailed: false,
      modelMentioned,
      host,
    }
  } catch {
    return { ok: false, blocked: false, fetchFailed: true, modelMentioned: false, host }
  } finally {
    clearTimeout(timer)
  }
}

async function shopifyProductsMentionModel(
  websiteUrl: string,
  modelName: string,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    const productsUrl = new URL("/products.json", websiteUrl)
    productsUrl.searchParams.set("limit", "50")
    const res = await fetch(productsUrl, {
      method: "GET",
      redirect: "follow",
      signal,
      headers: { accept: "application/json" },
    })
    if (!res.ok) return false
    const json: unknown = await res.json()
    if (!json || typeof json !== "object") return false
    const products = (json as { products?: unknown }).products
    if (!Array.isArray(products)) return false
    const haystack = products
      .map((p) => {
        if (!p || typeof p !== "object") return ""
        const row = p as { title?: unknown; handle?: unknown }
        return `${typeof row.title === "string" ? row.title : ""} ${typeof row.handle === "string" ? row.handle : ""}`
      })
      .join(" ")
    return officialSiteTextMentionsModel(haystack, modelName)
  } catch {
    return false
  }
}

async function queueReview(
  supabase: SupabaseClient,
  row: BackfillListingRow,
  input: {
    reason: string
    notes: string | null
    proposedBrand: string | null
    proposedModel: string | null
    matchedBrandId: string | null
    matchedBrandName: string | null
    needsBrand: boolean
    needsModel: boolean
  },
): Promise<void> {
  await upsertListingBrandModelUnmatched(supabase, {
    listing_id: row.id,
    listing_title: row.title,
    needs_brand: input.needsBrand,
    needs_model: input.needsModel,
    matched_brand_id: input.matchedBrandId,
    matched_brand_name: input.matchedBrandName,
    review_status: "needs_review",
    review_reason: input.reason,
    proposed_brand_name: input.proposedBrand,
    proposed_model_name: input.proposedModel,
    research_notes: input.notes,
    last_researched_at: new Date().toISOString(),
  })
}

async function attachResearchResult(
  supabase: SupabaseClient,
  row: BackfillListingRow,
  patch: ListingBrandModelPatch,
  created: { brand: boolean; model: boolean },
  source: "label_backfill" | "research_create" = "research_create",
): Promise<boolean> {
  const result = await applyListingBrandModelAttach(supabase, row.id, patch)
  if (!result.ok) return false

  await recordListingBrandModelAutofill(supabase, {
    listing_id: row.id,
    listing_title: row.title,
    brand_id: patch.brand_id ?? null,
    brand_name: patch.brand ?? null,
    brand_model_id: patch.brand_model_id ?? null,
    model_name: patch.model ?? null,
    attached_brand: Boolean(patch.brand_id) || created.brand,
    attached_model: Boolean(patch.brand_model_id) || created.model,
    source,
  })

  await syncListingToIndex(supabase, row.id).catch((e) => {
    console.error("[listing-brand-model-research] ES re-sync failed", {
      listingId: row.id,
      error: e instanceof Error ? e.message : String(e),
    })
  })
  return true
}

/**
 * Research unmatched live listings and, only when high-confidence + official
 * site verification passes, create the missing catalog brand/model and attach.
 */
export async function runListingBrandModelResearch(
  supabase: SupabaseClient,
  catalogs: Record<ListingBrandModelBackfillSection, SectionCatalog>,
  options?: { maxListings?: number },
): Promise<ListingBrandModelResearchSummary> {
  const summary = emptyResearchSummary()
  const maxListings = Math.max(1, options?.maxListings ?? DEFAULT_MAX_RESEARCH_PER_RUN)
  const researchedBefore = new Date(Date.now() - RESEARCH_COOLDOWN_MS).toISOString()

  const rows = await listUnmatchedListingsForResearch(supabase, {
    limit: maxListings,
    researchedBefore,
  })

  for (const row of rows) {
    summary.attempted += 1
    const catalog = catalogs[row.section]
    const category = productCategoryForSection(row.section)

    try {
      const candidates = extractListingBrandModelCandidates(row)
      let brand =
        (row.brand_id
          ? catalog.brands.find((b) => b.id === row.brand_id) ?? null
          : null) ??
        matchBrandFromLabel(candidates.brandName, catalog.brands) ??
        matchBrandFromLabel(row.brand, catalog.brands)

      let models = brand ? (catalog.modelsByBrand.get(brand.id) ?? []) : []
      let model =
        (row.brand_model_id
          ? models.find((m) => m.id === row.brand_model_id) ?? null
          : null) ??
        (brand
          ? matchModelFromLabel(candidates.modelName, models) ??
            matchModelFromLabel(row.model, models)
          : null)

      if (brand && model) {
        const patch: ListingBrandModelPatch = {}
        if (!row.brand_id) {
          patch.brand_id = brand.id
          patch.brand = brand.name
        }
        if (!row.brand_model_id) {
          patch.brand_model_id = model.id
          patch.model = model.name
        }
        const attached = await attachResearchResult(
          supabase,
          row,
          patch,
          { brand: false, model: false },
          "label_backfill",
        )
        if (attached) {
          summary.attached += 1
          await upsertListingBrandModelUnmatched(supabase, {
            listing_id: row.id,
            listing_title: row.title,
            needs_brand: false,
            needs_model: false,
            matched_brand_id: brand.id,
            matched_brand_name: brand.name,
            review_status: "unmatched",
            review_reason: null,
            proposed_brand_name: null,
            proposed_model_name: null,
            research_notes: "Matched existing catalog after label extract.",
            last_researched_at: new Date().toISOString(),
          })
          await clearListingBrandModelUnmatched(supabase, row.id)
        } else {
          summary.errors += 1
        }
        continue
      }

      const research = await researchListingWithLlm({
        title: row.title,
        brand: row.brand,
        model: row.model,
        section: row.section,
      })

      if (research?.brand_name && !brand) {
        brand = matchBrandFromLabel(research.brand_name, catalog.brands)
        if (brand) {
          models = catalog.modelsByBrand.get(brand.id) ?? []
          model =
            model ??
            matchModelFromLabel(research.model_name, models) ??
            matchModelFromLabel(candidates.modelName, models)
        }
      }

      const websiteForVerify =
        research?.official_website_url ??
        (brand ? (await getDirectoryBrandProfile(supabase, brand.id))?.website_url : null)
      const officialSite = websiteForVerify
        ? await verifyOfficialSite(websiteForVerify, research?.model_name ?? candidates.modelName)
        : null

      const decision = decideListingBrandModelCatalogCreate({
        hasCatalogBrand: Boolean(brand),
        hasCatalogModel: Boolean(model),
        extractedBrandName: candidates.brandName ?? research?.brand_name ?? null,
        extractedModelName: candidates.modelName ?? research?.model_name ?? null,
        research,
        officialSite,
      })

      if (decision.action === "queue_review") {
        summary.queued_for_review += 1
        await queueReview(supabase, row, {
          reason: decision.reason,
          notes: decision.notes,
          proposedBrand: research?.brand_name ?? candidates.brandName,
          proposedModel: research?.model_name ?? candidates.modelName,
          matchedBrandId: brand?.id ?? row.brand_id,
          matchedBrandName: brand?.name ?? row.brand,
          needsBrand: !row.brand_id && !brand,
          needsModel: !row.brand_model_id && !model,
        })
        continue
      }

      if (decision.action === "attach_existing") {
        summary.skipped += 1
        continue
      }

      const patch: ListingBrandModelPatch = {}
      let createdBrand = false
      let createdModel = false

      if (decision.createBrand || !brand) {
        const ensured = await ensureDirectoryBrandForListingCoverage(supabase, {
          name: decision.brandName,
          websiteUrl: decision.websiteUrl,
          locationLabel: decision.locationLabel,
          founderName: decision.founderName,
          shortDescription: decision.shortDescription,
          categories: [category],
          catalogBrands: catalog.brands,
        })
        if (!ensured.ok) {
          summary.errors += 1
          await queueReview(supabase, row, {
            reason: "create_failed",
            notes: ensured.error,
            proposedBrand: decision.brandName,
            proposedModel: decision.modelName,
            matchedBrandId: null,
            matchedBrandName: null,
            needsBrand: !row.brand_id,
            needsModel: !row.brand_model_id,
          })
          continue
        }
        brand = { id: ensured.brand.id, name: ensured.brand.name, slug: ensured.brand.slug }
        createdBrand = ensured.brand.created
        if (createdBrand) {
          catalog.brands.push(brand)
          catalog.modelsByBrand.set(brand.id, [])
          summary.brand_created += 1
        }
        models = catalog.modelsByBrand.get(brand.id) ?? []
      }

      if (brand && !row.brand_id) {
        patch.brand_id = brand.id
        patch.brand = brand.name
      }

      if (decision.createModel && decision.modelName && brand) {
        const ensuredModel = await ensureDirectoryModelForListingCoverage(supabase, {
          brandId: brand.id,
          name: decision.modelName,
          productCategorySlug: category,
          existingModels: models,
        })
        if (!ensuredModel.ok) {
          summary.errors += 1
          await queueReview(supabase, row, {
            reason: "create_failed",
            notes: ensuredModel.error,
            proposedBrand: brand.name,
            proposedModel: decision.modelName,
            matchedBrandId: brand.id,
            matchedBrandName: brand.name,
            needsBrand: false,
            needsModel: true,
          })
          continue
        }
        model = ensuredModel.model
        createdModel = ensuredModel.created
        if (createdModel) {
          models.push(model)
          catalog.modelsByBrand.set(brand.id, models)
          summary.model_created += 1
        }
      }

      if (brand && model && !row.brand_model_id) {
        patch.brand_model_id = model.id
        patch.model = model.name
      }

      if (!patch.brand_id && !patch.brand_model_id) {
        summary.queued_for_review += 1
        await queueReview(supabase, row, {
          reason: "low_confidence",
          notes: "Research confirmed a catalog gap but produced nothing to attach.",
          proposedBrand: decision.brandName,
          proposedModel: decision.modelName,
          matchedBrandId: brand?.id ?? null,
          matchedBrandName: brand?.name ?? null,
          needsBrand: !row.brand_id,
          needsModel: !row.brand_model_id,
        })
        continue
      }

      const attached = await attachResearchResult(supabase, row, patch, {
        brand: createdBrand,
        model: createdModel,
      })
      if (!attached) {
        summary.errors += 1
        continue
      }

      summary.attached += 1
      const stillNeedsBrand = !row.brand_id && !patch.brand_id
      const stillNeedsModel = !row.brand_model_id && !patch.brand_model_id
      if (stillNeedsBrand || stillNeedsModel) {
        await queueReview(supabase, row, {
          reason: stillNeedsModel ? "no_named_model" : "no_extractable_brand",
          notes: "Partial attach after research; remaining gap queued.",
          proposedBrand: decision.brandName,
          proposedModel: decision.modelName,
          matchedBrandId: brand?.id ?? null,
          matchedBrandName: brand?.name ?? null,
          needsBrand: stillNeedsBrand,
          needsModel: stillNeedsModel,
        })
      } else {
        await clearListingBrandModelUnmatched(supabase, row.id)
      }
    } catch (e) {
      summary.errors += 1
      console.error("[listing-brand-model-research] listing failed", {
        listingId: row.id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return summary
}

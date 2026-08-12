import {
  searchBrandModelsWithBrandsForSuggest,
  searchBrandsByName,
} from "@/lib/db/brand-models"
import {
  listEnabledSearchSynonyms,
  upsertSearchSynonymExpansions,
} from "@/lib/db/searchCuration"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { revalidateSearchSynonyms } from "@/lib/services/searchSynonyms"
import {
  compactSearchCurationKey,
  normalizeSearchCurationKey,
} from "@/lib/validations/searchCuration"
import type {
  SearchDailyLlmReport,
  SearchDailySynonymProposal,
} from "@/lib/validations/search-daily-report"

export type CatalogHint = {
  query: string
  brands: string[]
  models: { brand: string; model: string }[]
}

function catalogLabelKey(value: string): string {
  return normalizeSearchCurationKey(value).replace(/[^a-z0-9]+/g, " ").trim()
}

export async function loadCatalogHintsForQueries(
  queries: readonly string[],
): Promise<CatalogHint[]> {
  const db = createServiceRoleClient()
  const unique = [...new Set(queries.map((q) => q.trim()).filter((q) => q.length >= 2))].slice(
    0,
    20,
  )
  const hints: CatalogHint[] = []

  for (const query of unique) {
    const compacted = compactSearchCurationKey(query)
    const [models, compactModels, brands] = await Promise.all([
      searchBrandModelsWithBrandsForSuggest(db, query, 6),
      compacted !== normalizeSearchCurationKey(query)
        ? searchBrandModelsWithBrandsForSuggest(db, compacted, 6)
        : Promise.resolve([]),
      searchBrandsByName(db, query, 6),
    ])
    const modelRows = [...models, ...compactModels]
    const seenModels = new Set<string>()
    const modelHints: { brand: string; model: string }[] = []
    for (const row of modelRows) {
      const key = `${row.brandName}::${row.name}`.toLowerCase()
      if (seenModels.has(key)) continue
      seenModels.add(key)
      modelHints.push({ brand: row.brandName, model: row.name })
    }
    hints.push({
      query,
      brands: [...new Set(brands.map((b) => b.name))],
      models: modelHints.slice(0, 8),
    })
  }

  return hints
}

export async function loadExistingSynonymSummaries(): Promise<
  { term: string; expansions: string[] }[]
> {
  const db = createServiceRoleClient()
  const rows = await listEnabledSearchSynonyms(db)
  return rows.slice(0, 80).map((row) => ({
    term: row.term,
    expansions: row.expansions,
  }))
}

function expansionMatchesCatalog(
  expansion: string,
  hint: CatalogHint | undefined,
): boolean {
  const needle = catalogLabelKey(expansion)
  if (!needle) return false
  for (const brand of hint?.brands ?? []) {
    if (catalogLabelKey(brand) === needle) return true
  }
  for (const model of hint?.models ?? []) {
    const modelKey = catalogLabelKey(model.model)
    const full = catalogLabelKey(`${model.brand} ${model.model}`)
    if (needle === modelKey || needle === full) return true
    if (full.includes(needle) && needle.length >= 4) return true
    if (needle.includes(modelKey) && modelKey.length >= 4) return true
  }
  return false
}

function termsToWrite(proposal: SearchDailySynonymProposal): string[] {
  const primary = normalizeSearchCurationKey(proposal.term || proposal.query)
  if (!primary) return []
  const compacted = compactSearchCurationKey(primary)
  return compacted && compacted !== primary ? [primary, compacted] : [primary]
}

export async function applySearchDailySynonymProposals(
  report: SearchDailyLlmReport,
  catalogHints: CatalogHint[],
  createdBy?: string | null,
): Promise<SearchDailyLlmReport> {
  const proposals = report.synonymProposals ?? []
  if (proposals.length === 0) return report

  const db = createServiceRoleClient()
  const hintByQuery = new Map(
    catalogHints.map((hint) => [normalizeSearchCurationKey(hint.query), hint]),
  )
  let wrote = false
  const next: SearchDailySynonymProposal[] = []

  for (const proposal of proposals) {
    if (proposal.applied) {
      next.push(proposal)
      continue
    }
    if (!proposal.apply) {
      next.push({
        ...proposal,
        applied: false,
        skippedReason: proposal.skippedReason ?? "Inventory gap — not a catalog alias",
      })
      continue
    }

    const queryKey = normalizeSearchCurationKey(proposal.query || proposal.term)
    let hint = hintByQuery.get(queryKey)
    if (!hint && queryKey) {
      const loaded = await loadCatalogHintsForQueries([proposal.query || proposal.term])
      hint = loaded[0]
      if (hint) hintByQuery.set(queryKey, hint)
    }
    const expansions = [...new Set(proposal.expansions.map((e) => e.trim()).filter(Boolean))]
    const catalogExpansions = expansions.filter((expansion) =>
      expansionMatchesCatalog(expansion, hint),
    )
    if (catalogExpansions.length === 0) {
      next.push({
        ...proposal,
        applied: false,
        skippedReason: "No matching brand or model in the catalog",
      })
      continue
    }

    const terms = termsToWrite(proposal)
    let errorMessage: string | null = null
    for (const term of terms) {
      const result = await upsertSearchSynonymExpansions(db, {
        term,
        expansions: catalogExpansions,
        createdBy: createdBy ?? null,
      })
      if (result.error || !result.data) {
        errorMessage = result.error?.message ?? "Could not save synonym"
        break
      }
    }

    if (errorMessage) {
      next.push({ ...proposal, applied: false, skippedReason: errorMessage })
      continue
    }

    wrote = true
    next.push({
      ...proposal,
      expansions: catalogExpansions,
      applied: true,
      skippedReason: undefined,
    })
  }

  if (wrote) revalidateSearchSynonyms()
  return { ...report, synonymProposals: next }
}

export async function applySearchDailySynonymForQuery(
  report: SearchDailyLlmReport,
  query: string,
  catalogHints: CatalogHint[],
  createdBy?: string | null,
): Promise<SearchDailyLlmReport> {
  const needle = normalizeSearchCurationKey(query)
  let proposals = [...(report.synonymProposals ?? [])]
  const existing = proposals.find(
    (proposal) => normalizeSearchCurationKey(proposal.query) === needle,
  )
  if (!existing) {
    const loaded = catalogHints.length > 0 ? catalogHints : await loadCatalogHintsForQueries([query])
    const hint = loaded.find((row) => normalizeSearchCurationKey(row.query) === needle) ?? loaded[0]
    const expansions = [
      ...(hint?.models.map((model) => `${model.brand} ${model.model}`) ?? []),
      ...(hint?.brands ?? []),
    ].filter(Boolean)
    proposals.push({
      query,
      term: needle,
      expansions: expansions.slice(0, 8),
      reason: "Added from the search daily report",
      apply: true,
    })
  } else {
    proposals = proposals.map((proposal) =>
      normalizeSearchCurationKey(proposal.query) === needle
        ? { ...proposal, apply: true, applied: false, skippedReason: undefined }
        : proposal,
    )
  }
  return applySearchDailySynonymProposals(
    { ...report, synonymProposals: proposals },
    catalogHints,
    createdBy,
  )
}

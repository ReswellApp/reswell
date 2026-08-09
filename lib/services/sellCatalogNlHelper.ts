/**
 * Parallel AI helper for the `/sell` catalog search wall.
 *
 * Never on the critical path — the client calls
 * `/api/sell/catalog-search/nl-helper` after the primary Elasticsearch search
 * settles weak or empty. The LLM normalizes messy seller text into clean
 * brand/model/category; retrieval then re-runs through the same ES-backed
 * catalog search with the cleaned text.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { searchSellCatalogForSell } from "@/lib/services/sellCatalogSearch"
import {
  isSellCatalogNlSearchEnabled,
  sellCatalogQueryLikelyNeedsLlm,
  understandSellCatalogQueryWithLlm,
} from "@/lib/services/sellCatalogQueryUnderstand"
import {
  emptySellCatalogNlHelperResponse,
  type SellCatalogNlHelperResponse,
} from "@/lib/types/sell-catalog-nl-helper"
import type {
  SellCatalogSearchCategory,
  SellCatalogSearchResultRow,
} from "@/lib/types/sell-catalog-search"

const MAX_HELPER_ROWS = 8

export async function runSellCatalogNlHelper(
  supabase: SupabaseClient,
  rawQuery: string,
  allowedCategories: readonly SellCatalogSearchCategory[],
): Promise<SellCatalogNlHelperResponse> {
  const q = (rawQuery || "").trim()
  if (q.length < 2 || allowedCategories.length === 0) {
    return emptySellCatalogNlHelperResponse("empty_query")
  }

  if (!isSellCatalogNlSearchEnabled()) {
    return emptySellCatalogNlHelperResponse("nl_disabled")
  }

  if (!sellCatalogQueryLikelyNeedsLlm(q)) {
    return emptySellCatalogNlHelperResponse("rules_sufficient")
  }

  const intent = await understandSellCatalogQueryWithLlm(q, { force: true })
  if (!intent) {
    return emptySellCatalogNlHelperResponse("llm_unavailable")
  }

  const brandText = intent.brandText?.trim() || null
  const modelText = intent.modelText?.trim() || null
  const category =
    intent.category && allowedCategories.includes(intent.category)
      ? intent.category
      : null

  const lookup = [brandText, modelText].filter(Boolean).join(" ").trim()
  if (lookup.length < 2) {
    return {
      ok: true,
      skipped: true,
      reason: "no_catalog_intent",
      summary: intent.summary.trim(),
      applied: { brandText, modelText, category },
      rows: [],
    }
  }

  const categories = category ? [category] : allowedCategories
  const result = await searchSellCatalogForSell(supabase, lookup, { categories })
  const rows: SellCatalogSearchResultRow[] = (
    result.results.length > 0 ? result.results : result.similarResults
  ).slice(0, MAX_HELPER_ROWS)

  return {
    ok: true,
    summary: intent.summary.trim() || lookup,
    applied: { brandText, modelText, category },
    rows,
  }
}

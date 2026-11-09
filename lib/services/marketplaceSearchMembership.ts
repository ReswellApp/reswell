/**
 * Would this listing show up on `/search?q=`?
 * Uses the first result pass that actually has rows — the page the shopper sees —
 * and does not invent a looser match of its own.
 */

import {
  activeBrandInventoryHasListings,
  listActiveListingIdsByBrandModelIds,
  listingIsInActiveBrandInventory,
} from "@/lib/db/brand-listings"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { searchListingIdsFromElasticsearch } from "@/lib/elasticsearch/listings-index"
import {
  buildMarketplaceSearchPlan,
  type MarketplaceSearchEsPass,
  type MarketplaceSearchPlan,
} from "@/lib/services/marketplaceSearchPlan"
import {
  parseMarketplaceQuery,
  type MarketplaceParsedQuery,
} from "@/lib/services/marketplaceQueryParse"
import { resolveDirectoryBrandRowFromLabel } from "@/lib/services/brandDirectorySearch"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { isMarketplaceSectionOnlyQuery } from "@/lib/utils/marketplace-brand-query"
import {
  isMarketplaceBoardStyleOnlyQuery,
  isMarketplaceGenericSurfSearchOnly,
} from "@/lib/utils/marketplace-style-query"
import type { SupabaseClient } from "@supabase/supabase-js"

export type MarketplaceSearchWinner =
  | {
      kind: "brand"
      brand: { id: string; name: string }
      categoryId: string | null
      sections: string[] | undefined
    }
  | { kind: "es"; pass: MarketplaceSearchEsPass; expansions: string[] }
  | { kind: "model"; brandModelIds: string[]; sections: string[] }
  | { kind: "none" }
  | { kind: "unavailable" }

/** Reuses parses and the winning `/search` pass across saved searches for one listing. */
export type SavedSearchMatchCache = {
  marketplaceParses: Map<string, MarketplaceParsedQuery | "error">
  searchWinners: Map<string, MarketplaceSearchWinner>
}

async function parsedQueryForSearch(
  q: string,
  cache: SavedSearchMatchCache | undefined,
  service: SupabaseClient,
): Promise<MarketplaceParsedQuery | null> {
  const key = q.trim().toLowerCase()
  const cached = cache?.marketplaceParses.get(key)
  if (cached === "error") return null
  if (cached) return cached

  try {
    const parsed = await parseMarketplaceQuery(service, q)
    cache?.marketplaceParses.set(key, parsed)
    return parsed
  } catch (err) {
    console.error("[saved_search] marketplace query parse failed:", err)
    cache?.marketplaceParses.set(key, "error")
    return null
  }
}

async function brandForSearch(
  rawQuery: string,
  parsed: MarketplaceParsedQuery | null,
  service: SupabaseClient,
): Promise<{ id: string; name: string } | null> {
  if (parsed?.brand) {
    return { id: parsed.brand.id, name: parsed.brand.name }
  }
  const raw = rawQuery.trim()
  if (
    !raw ||
    parsed?.model ||
    isMarketplaceSectionOnlyQuery(raw) ||
    isMarketplaceBoardStyleOnlyQuery(raw) ||
    isMarketplaceGenericSurfSearchOnly(raw)
  ) {
    return null
  }
  const row = await resolveDirectoryBrandRowFromLabel(service, raw)
  if (!row) return null
  return { id: row.id, name: row.name }
}

async function esPassHasRows(
  pass: MarketplaceSearchEsPass,
  expansions: string[],
): Promise<string[]> {
  return searchListingIdsFromElasticsearch(pass.q, 1, {
    expansions,
    sections: pass.sections,
    brandId: pass.brandId,
    brandModelIds: pass.brandModelIds,
    lengthInches: pass.lengthInches,
    boardTypes: pass.boardTypes,
    typoFallback: pass.typoFallback,
  })
}

async function resolveSearchWinner(
  rawQuery: string,
  plan: MarketplaceSearchPlan,
  service: SupabaseClient,
): Promise<MarketplaceSearchWinner> {
  if (plan.useBrandInventory && plan.brand) {
    const hasRows = await activeBrandInventoryHasListings(service, plan.brand, {
      categoryId: plan.categoryId,
      sections: plan.inventorySections,
    })
    if (hasRows) {
      return {
        kind: "brand",
        brand: plan.brand,
        categoryId: plan.categoryId,
        sections: plan.inventorySections,
      }
    }
    if (plan.inventoryIsFinal) return { kind: "none" }
  }

  if (!rawQuery.trim()) return { kind: "none" }
  if (!isElasticsearchConfigured()) return { kind: "unavailable" }

  try {
    for (const pass of plan.esPasses) {
      const ids = await esPassHasRows(pass, plan.expansions)
      if (ids.length > 0) {
        return { kind: "es", pass, expansions: plan.expansions }
      }
    }
  } catch (err) {
    console.error("[saved_search] search pass lookup failed:", err)
    return { kind: "unavailable" }
  }

  if (plan.brandModelIds.length > 0) {
    const ids = await listActiveListingIdsByBrandModelIds(service, plan.brandModelIds, {
      limit: 1,
      sections: plan.sections,
    })
    if (ids.length > 0) {
      return { kind: "model", brandModelIds: plan.brandModelIds, sections: plan.sections }
    }
  }

  return { kind: "none" }
}

async function listingInWinner(
  listingId: string,
  winner: MarketplaceSearchWinner,
  service: SupabaseClient,
): Promise<boolean | null> {
  if (winner.kind === "unavailable") return null
  if (winner.kind === "none") return false

  if (winner.kind === "brand") {
    return listingIsInActiveBrandInventory(service, listingId, winner.brand, {
      categoryId: winner.categoryId,
      sections: winner.sections,
    })
  }

  if (winner.kind === "model") {
    const { data, error } = await service
      .from("listings")
      .select("id")
      .eq("id", listingId)
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .in("brand_model_id", winner.brandModelIds)
      .in("section", winner.sections)
      .limit(1)
    if (error) {
      console.error("[saved_search] model search membership failed:", error.message)
      return false
    }
    return (data ?? []).some((row) => row.id === listingId)
  }

  const ids = await searchListingIdsFromElasticsearch(winner.pass.q, 1, {
    expansions: winner.expansions,
    sections: winner.pass.sections,
    brandId: winner.pass.brandId,
    brandModelIds: winner.pass.brandModelIds,
    lengthInches: winner.pass.lengthInches,
    boardTypes: winner.pass.boardTypes,
    typoFallback: winner.pass.typoFallback,
    restrictToIds: [listingId],
  })
  return ids.includes(listingId)
}

/**
 * True when opening `/search?q=` would include this listing in the results
 * the page is showing. Null when search could not be run.
 */
export async function listingAppearsInMarketplaceSearch(
  listingId: string,
  rawQuery: string,
  cache?: SavedSearchMatchCache,
): Promise<boolean | null> {
  const q = rawQuery.trim()
  if (!q || !listingId.trim()) return false

  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch (err) {
    console.error("[saved_search] marketplace search client failed:", err)
    return null
  }

  const key = q.toLowerCase()
  try {
    let winner = cache?.searchWinners.get(key)
    if (!winner) {
      const parsed = await parsedQueryForSearch(q, cache, service)
      if (!parsed) return null
      const brand = await brandForSearch(q, parsed, service)
      const plan = buildMarketplaceSearchPlan({
        rawQuery: q,
        parsed,
        brand,
        brandFromUrl: false,
        categoryId: null,
      })
      winner = await resolveSearchWinner(q, plan, service)
      cache?.searchWinners.set(key, winner)
    }

    return await listingInWinner(listingId, winner, service)
  } catch (err) {
    console.error("[saved_search] marketplace search membership failed:", err)
    return null
  }
}

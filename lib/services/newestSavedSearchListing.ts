/**
 * Newest active listing that would appear in a saved search.
 * Attached to the Klaviyo `Saved Search` event. Not rendered in the save-search bar.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { isBoardsBrowseEsEnabled } from "@/lib/db/boards-browse-listings-es"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { ELASTICSEARCH_INDEXED_LISTING_SECTIONS } from "@/lib/elasticsearch/listing-sections"
import { searchBoardsBrowse } from "@/lib/elasticsearch/boards-browse-search"
import {
  meaningfulSearchTerms,
  searchListingIdsFromElasticsearch,
} from "@/lib/elasticsearch/listings-index"
import {
  savedSearchHeroFromListing,
  type SavedSearchHeroListing,
  type SavedSearchHeroSource,
} from "@/lib/saved-search-hero"
import { boardSavedCriteriaToBrowseEsParams } from "@/lib/services/boardSavedSearchMatch"
import { resolveSavedSearchSection } from "@/lib/utils/peer-saved-search-criteria"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

const HERO_SELECT =
  "id, slug, title, price, section, primary_image_url, primary_thumbnail_url"

function priceWithinCriteria(price: number, criteria: BoardSavedSearchCriteria): boolean {
  if (criteria.minPrice != null && Number.isFinite(criteria.minPrice) && price < criteria.minPrice) {
    return false
  }
  if (criteria.maxPrice != null && Number.isFinite(criteria.maxPrice) && price > criteria.maxPrice) {
    return false
  }
  return true
}

function ilikeOrPattern(term: string): string {
  const safe = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return `"%${safe}%"`
}

async function loadHeroRow(
  supabase: SupabaseClient,
  id: string,
): Promise<SavedSearchHeroSource | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(HERO_SELECT)
    .eq("id", id)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .maybeSingle()

  if (error || !data) return null
  return data as SavedSearchHeroSource
}

async function newestFromSupabase(
  supabase: SupabaseClient,
  criteria: BoardSavedSearchCriteria,
): Promise<SavedSearchHeroListing | null> {
  let query = supabase
    .from("listings")
    .select(HERO_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  const section = resolveSavedSearchSection(criteria)
  if (section === "any") {
    query = query.in("section", [...ELASTICSEARCH_INDEXED_LISTING_SECTIONS])
  } else {
    query = query.eq("section", section)
  }

  const brandModelId = criteria.brandModelId?.trim()
  const brandId = criteria.brandId?.trim()
  if (brandModelId) query = query.eq("brand_model_id", brandModelId)
  else if (brandId) query = query.eq("brand_id", brandId)

  if (criteria.minPrice != null && Number.isFinite(criteria.minPrice)) {
    query = query.gte("price", criteria.minPrice)
  }
  if (criteria.maxPrice != null && Number.isFinite(criteria.maxPrice)) {
    query = query.lte("price", criteria.maxPrice)
  }
  if (criteria.shipping === true) {
    query = query.eq("shipping_available", true)
  }

  const keyword = criteria.q?.trim() ?? ""
  if (keyword) {
    const terms = meaningfulSearchTerms(keyword)
    const needles = terms.length > 0 ? terms : [keyword]
    for (const term of needles) {
      const pattern = ilikeOrPattern(term)
      query = query.or(
        `title.ilike.${pattern},brand.ilike.${pattern},model.ilike.${pattern}`,
      )
    }
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return savedSearchHeroFromListing(data as SavedSearchHeroSource)
}

async function newestIdFromListingSearch(
  criteria: BoardSavedSearchCriteria,
  section: ReturnType<typeof resolveSavedSearchSection>,
): Promise<string | null> {
  const sections =
    section === "any" ? [...ELASTICSEARCH_INDEXED_LISTING_SECTIONS] : [section]
  const ids = await searchListingIdsFromElasticsearch(criteria.q?.trim() ?? "", 1, {
    sections,
    order: "newest",
    brandId: criteria.brandModelId?.trim() ? null : criteria.brandId,
    brandModelId: criteria.brandModelId,
  })
  return ids[0] ?? null
}

/**
 * The single newest listing matching `criteria`, or null when nothing matches.
 * Failures are swallowed so saving a search never depends on this lookup.
 */
export async function newestListingForSavedSearch(
  supabase: SupabaseClient,
  criteria: BoardSavedSearchCriteria,
): Promise<SavedSearchHeroListing | null> {
  try {
    const section = resolveSavedSearchSection(criteria)

    if (section === "surfboards" && isBoardsBrowseEsEnabled()) {
      const res = await searchBoardsBrowse({
        ...boardSavedCriteriaToBrowseEsParams(criteria),
        sort: "created-at",
        from: 0,
        size: 1,
      })
      if (res) {
        const id = res.ids[0]
        if (!id) return null
        const row = await loadHeroRow(supabase, id)
        return row ? savedSearchHeroFromListing(row) : null
      }
    }

    if (isElasticsearchConfigured()) {
      try {
        const id = await newestIdFromListingSearch(criteria, section)
        if (!id) return null
        const row = await loadHeroRow(supabase, id)
        const hero = row ? savedSearchHeroFromListing(row) : null
        if (hero && priceWithinCriteria(hero.price, criteria)) return hero
      } catch (err) {
        console.error("[saved_search] newest listing elasticsearch failed:", err)
      }
    }

    return await newestFromSupabase(supabase, criteria)
  } catch (err) {
    console.error("[saved_search] newest listing lookup failed:", err)
    return null
  }
}

import { after } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { MarketplaceParsedQuery } from "@/lib/services/marketplaceQueryParse"
import {
  attachNlHelperToSearchQualityEvent,
  insertSearchQualityEvent,
  listRatedSearchQualityMemory,
  type SearchQualityEventRow,
  type SearchQualityListingPreview,
  type SearchQualityListingRatings,
  type SearchQualityNlSnapshot,
  type SearchQualityRulesSnapshot,
} from "@/lib/db/searchQuality"
import { listingTitleThumbnailCandidates } from "@/lib/listing-image-display"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import {
  normalizeSearchQualityQuery,
  SEARCH_QUALITY_MATCH_TARGET,
} from "@/lib/validations/searchQuality"
import { displayMarketplaceSearchQueryForAnalytics } from "@/lib/services/searchAnalytics"
import type { MarketplaceNlHelperRefine } from "@/lib/utils/marketplace-nl-helper-refine"

export { SEARCH_QUALITY_MATCH_TARGET }

export function newSearchQualityEventId(): string {
  return crypto.randomUUID()
}

export function rulesSnapshotFromParsed(
  parsed: MarketplaceParsedQuery | null,
  extraStyles: string[] = [],
): SearchQualityRulesSnapshot {
  const styles = [
    ...new Set([...(parsed?.styleIntent ?? []), ...extraStyles].filter(Boolean)),
  ]
  return {
    brand: parsed?.brand?.name ?? null,
    brandId: parsed?.brand?.id ?? null,
    model: parsed?.model?.name ?? null,
    styles,
    lengthToken: parsed?.lengthToken ?? null,
    isBrandOnly: Boolean(parsed?.isBrandOnly),
    sectionIntent: parsed?.sectionIntent ?? null,
    textQuery: parsed?.textQuery ?? "",
  }
}

export function listingPreviewFromCard(input: {
  id: string
  title: string
  slug?: string | null
  price?: number | string | null
  board_type?: string | null
  listing_images?: ListingImageForCard[] | null
}): SearchQualityListingPreview {
  const priceRaw = input.price
  const price =
    typeof priceRaw === "number"
      ? priceRaw
      : typeof priceRaw === "string"
        ? Number.parseFloat(priceRaw)
        : null
  return {
    id: input.id,
    title: input.title,
    slug: input.slug ?? null,
    price: price != null && Number.isFinite(price) ? price : null,
    imageUrl: listingTitleThumbnailCandidates(input.listing_images ?? [])[0] ?? null,
    boardType: input.board_type ?? null,
  }
}

/**
 * Persist a search result snapshot after the response is sent.
 * Failures are logged and never thrown to the shopper path.
 */
export function scheduleSearchQualityEventCapture(input: {
  eventId: string
  rawQuery: string
  searchSurface: "marketplace" | "boards"
  backend: "elasticsearch" | "supabase" | null
  listings: Array<{
    id: string
    title: string
    slug?: string | null
    price?: number | string | null
    board_type?: string | null
    listing_images?: ListingImageForCard[] | null
  }>
  parsed: MarketplaceParsedQuery | null
  extraStyles?: string[]
}): void {
  const q = input.rawQuery.trim()
  if (q.length < 2) return

  after(async () => {
    try {
      const service = createServiceRoleClient()
      await insertSearchQualityEvent(service, {
        id: input.eventId,
        queryDisplay: displayMarketplaceSearchQueryForAnalytics(q),
        queryNormalized: normalizeSearchQualityQuery(q),
        searchSurface: input.searchSurface,
        backend: input.backend,
        listingIds: input.listings.map((l) => l.id),
        listingsPreview: input.listings.map(listingPreviewFromCard),
        rulesSnapshot: rulesSnapshotFromParsed(input.parsed, input.extraStyles),
      })
    } catch (e) {
      console.error("[searchQuality] capture failed:", e)
    }
  })
}

export async function attachNlHelperSnapshotToEvent(input: {
  eventId: string | null | undefined
  rawQuery: string
  skipped: boolean
  reason?: string | null
  summary: string
  appliedLabels: string[]
  refine: MarketplaceNlHelperRefine
  rankedIds?: string[]
  dropIds?: string[]
  extraPhrases?: string[]
}): Promise<void> {
  const eventId = input.eventId?.trim()
  if (!eventId) return
  const q = input.rawQuery.trim()
  if (q.length < 2) return

  const snapshot: SearchQualityNlSnapshot = {
    skipped: input.skipped,
    reason: input.reason ?? null,
    summary: input.summary,
    appliedLabels: input.appliedLabels,
    refine: { ...input.refine },
    rankedIds: input.rankedIds ?? [],
    dropIds: input.dropIds ?? [],
    extraPhrases: input.extraPhrases ?? [],
  }

  try {
    const service = createServiceRoleClient()
    await attachNlHelperToSearchQualityEvent(service, {
      eventId,
      queryDisplay: displayMarketplaceSearchQueryForAnalytics(q),
      queryNormalized: normalizeSearchQualityQuery(q),
      snapshot,
    })
  } catch (e) {
    console.error("[searchQuality] attach NL helper failed:", e)
  }
}

function formatListingMemory(row: {
  listingsPreview: SearchQualityListingPreview[]
  listingRatings: SearchQualityListingRatings
}): string | null {
  const titles = new Map(row.listingsPreview.map((listing) => [listing.id, listing.title]))
  const buckets: Record<"good" | "close" | "bad", string[]> = {
    good: [],
    close: [],
    bad: [],
  }
  for (const [id, rating] of Object.entries(row.listingRatings)) {
    const title = (titles.get(id) ?? id).slice(0, 80)
    buckets[rating].push(title)
  }
  const parts = [
    buckets.good.length ? `keep: ${buckets.good.slice(0, 8).join("; ")}` : null,
    buckets.close.length ? `close: ${buckets.close.slice(0, 8).join("; ")}` : null,
    buckets.bad.length ? `drop: ${buckets.bad.slice(0, 8).join("; ")}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(" · ") : null
}

function formatMemoryLine(row: {
  queryDisplay: string
  resultRating: string | null
  llmRating: string | null
  ratingNote: string | null
  rulesSnapshot: SearchQualityRulesSnapshot
  nlHelper: SearchQualityNlSnapshot | null
  listingsPreview: SearchQualityListingPreview[]
  listingRatings: SearchQualityListingRatings
}): string {
  const rating = (row.llmRating ?? row.resultRating ?? "unrated").toUpperCase()
  const brand = row.rulesSnapshot.brand
  const model = row.rulesSnapshot.model
  const styles = row.rulesSnapshot.styles
  const nlSummary = row.nlHelper?.summary?.trim()
  const listings = formatListingMemory(row)
  const parts = [
    `Query "${row.queryDisplay}" → ${rating}`,
    brand ? `brand ${brand}` : null,
    model ? `model ${model}` : null,
    styles.length ? `style ${styles.join(",")}` : null,
    nlSummary ? `LLM: ${nlSummary}` : null,
    listings,
    row.ratingNote?.trim() ? `admin: ${row.ratingNote.trim()}` : null,
  ].filter(Boolean)
  return `- ${parts.join(" · ")}`
}

/**
 * Few-shot block injected into Gemini so it learns from admin Good/Close/Bad ratings.
 */
export async function searchQualityMemoryPromptBlock(rawQuery: string): Promise<string> {
  try {
    const service = createServiceRoleClient()
    const rows = await listRatedSearchQualityMemory(service, {
      queryNormalized: normalizeSearchQualityQuery(rawQuery),
      limit: 16,
    })
    if (rows.length === 0) return ""
    const lines = rows.map((row: SearchQualityEventRow) =>
      formatMemoryLine({
        queryDisplay: row.queryDisplay,
        resultRating: row.resultRating,
        llmRating: row.llmRating,
        ratingNote: row.ratingNote,
        rulesSnapshot: row.rulesSnapshot,
        nlHelper: row.nlHelper,
        listingsPreview: row.listingsPreview,
        listingRatings: row.listingRatings,
      }),
    )
    return `
Admin quality memory from rated searches (Good = keep doing this, Close = almost, Bad = do not repeat). Treat these as ground truth for similar queries:
${lines.join("\n")}`
  } catch (e) {
    console.error("[searchQuality] memory prompt failed:", e)
    return ""
  }
}

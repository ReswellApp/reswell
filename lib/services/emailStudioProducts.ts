import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchEmailStudioProductRowsByIds,
  searchEmailStudioProductRows,
  type EmailStudioProductRow,
} from "@/lib/db/emailStudioProducts"
import {
  absoluteKlaviyoListingImageUrl,
  absoluteKlaviyoListingUrl,
  formatKlaviyoPriceDisplay,
  parseKlaviyoListingPrice,
} from "@/lib/klaviyo/catalog-product"
import { formatListingDimensionsLine } from "@/lib/listing-dimensions-display"
import {
  isListingPubliclyVisible,
  isListingPurchasable,
} from "@/lib/listing-public-visibility"
import type {
  EmailBlock,
  EmailStudioDocument,
  EmailStudioProductAvailability,
  EmailStudioProductSnapshot,
} from "@/lib/types/emailStudio"

function availability(row: EmailStudioProductRow): EmailStudioProductAvailability {
  if (row.status === "sold") return "sold"
  if (row.status === "pending_sale" && isListingPubliclyVisible(row)) return "pending"
  if (isListingPurchasable(row)) return "available"
  return "unavailable"
}

export function emailStudioProductSnapshot(
  row: EmailStudioProductRow,
): EmailStudioProductSnapshot {
  return {
    id: row.id,
    title: row.title?.trim() || "Untitled listing",
    priceDisplay: formatKlaviyoPriceDisplay(parseKlaviyoListingPrice(row.price)),
    condition: row.condition?.trim() || "",
    dimensions: formatListingDimensionsLine(row) ?? "",
    boardType: row.board_type?.trim() || "",
    imageUrl: absoluteKlaviyoListingImageUrl(row),
    productUrl: absoluteKlaviyoListingUrl(row),
    availability: availability(row),
  }
}

export async function searchEmailStudioProducts(
  supabase: SupabaseClient,
  query: string,
): Promise<EmailStudioProductSnapshot[]> {
  const rows = await searchEmailStudioProductRows(supabase, query)
  return rows.map(emailStudioProductSnapshot)
}

export async function loadEmailStudioProducts(
  supabase: SupabaseClient,
  listingIds: readonly string[],
): Promise<EmailStudioProductSnapshot[]> {
  const ids = [...new Set(listingIds)].slice(0, 4)
  const rows = await fetchEmailStudioProductRowsByIds(supabase, ids)
  const snapshots = new Map(rows.map((row) => [row.id, emailStudioProductSnapshot(row)]))
  return ids.flatMap((id) => {
    const snapshot = snapshots.get(id)
    return snapshot ? [snapshot] : []
  })
}

export async function hydrateEmailStudioProductBlocks(
  supabase: SupabaseClient,
  document: EmailStudioDocument,
): Promise<EmailStudioDocument> {
  const ids = document.blocks.flatMap((block) => block.type === "product" ? block.listingIds : [])
  if (ids.length === 0) return document

  const liveItems = await loadEmailStudioProducts(supabase, ids)
  const liveById = new Map(liveItems.map((item) => [item.id, item]))
  const blocks: EmailBlock[] = document.blocks.map((block) => {
    if (block.type !== "product") return block
    const cachedById = new Map(block.items.map((item) => [item.id, item]))
    return {
      ...block,
      items: block.listingIds.flatMap((id) => {
        const live = liveById.get(id)
        if (live) return [live]
        const cached = cachedById.get(id)
        return cached ? [{ ...cached, availability: "unavailable" as const }] : []
      }),
    }
  })
  return { ...document, blocks }
}

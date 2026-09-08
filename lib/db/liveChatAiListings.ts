/**
 * Scoped listing reads for live chat AI — the signed-in seller's own listings only.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { listingDetailHref } from "@/lib/listing-href"

export type LiveChatAiListingSummary = {
  title: string | null
  status: string | null
  price: number | null
  listing_href: string
  created_at: string | null
}

type ListingRow = {
  id: string
  title: string | null
  slug: string | null
  status: string | null
  price: string | number | null
  section: string | null
  created_at: string | null
}

function money(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

function toSummary(row: ListingRow): LiveChatAiListingSummary {
  return {
    title: row.title?.trim() || null,
    status: row.status?.trim() || null,
    price: money(row.price),
    listing_href: listingDetailHref({
      id: row.id,
      slug: row.slug,
      section: row.section ?? undefined,
    }),
    created_at: row.created_at,
  }
}

/** Recent listings owned by the signed-in member. */
export async function listRecentLiveChatAiListingsForMember(
  supabase: SupabaseClient,
  userId: string,
  limit = 6,
): Promise<LiveChatAiListingSummary[]> {
  const take = Math.max(1, Math.min(limit, 10))

  const { data, error } = await supabase
    .from("listings")
    .select("id, title, slug, status, price, section, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(take)

  if (error) {
    console.error("[liveChatAiListings] list recent", error.message)
    return []
  }

  return ((data ?? []) as unknown as ListingRow[]).map(toSummary)
}

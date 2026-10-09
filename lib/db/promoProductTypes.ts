import type { SupabaseClient } from "@supabase/supabase-js"
import { isPeerListingSection, type PeerListingSection } from "@/lib/peer-listing-sections"

export type PromoPricedListingRow = {
  id: string
  user_id: string
  price: string | number
  section: string | null
  title: string | null
  slug: string | null
  stock_quantity: number | null
}

export async function dbListPromoPricedListings(
  supabase: SupabaseClient,
  listingIds: readonly string[],
): Promise<{ rows: PromoPricedListingRow[]; error: string | null }> {
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return { rows: [], error: null }

  const { data, error } = await supabase
    .from("listings")
    .select("id, user_id, price, section, title, slug, stock_quantity")
    .in("id", ids)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as PromoPricedListingRow[], error: null }
}

function isMissingShopifyMappingTable(error: { code?: string; message?: string } | null): boolean {
  const message = error?.message ?? ""
  if (!message.includes("shopify_product_mappings")) return false
  return (
    error?.code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  )
}

/** Selected Shopify mappings, keyed by listing id. Missing table yields an empty map. */
export async function dbShopifyReswellSectionsByListingIds(
  supabase: SupabaseClient,
  listingIds: readonly string[],
): Promise<{ sections: Map<string, PeerListingSection>; error: string | null }> {
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return { sections: new Map(), error: null }

  const { data, error } = await supabase
    .from("shopify_product_mappings")
    .select("listing_id, reswell_section")
    .in("listing_id", ids)
    .eq("selected", true)

  if (error) {
    if (isMissingShopifyMappingTable(error)) return { sections: new Map(), error: null }
    return { sections: new Map(), error: error.message }
  }

  const sections = new Map<string, PeerListingSection>()
  for (const row of data ?? []) {
    const record = row as { listing_id?: unknown; reswell_section?: unknown }
    const listingId = typeof record.listing_id === "string" ? record.listing_id : ""
    const section = typeof record.reswell_section === "string" ? record.reswell_section : ""
    if (listingId && isPeerListingSection(section)) sections.set(listingId, section)
  }
  return { sections, error: null }
}

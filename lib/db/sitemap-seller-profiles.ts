import type { SupabaseClient } from "@supabase/supabase-js"

export interface SellerProfileSitemapEntry {
  path: string
  lastModified: Date
}

/**
 * Public seller shops (`/sellers/[slug]`) — same eligibility signal as the sellers directory:
 * shops (`is_shop`) or anyone with at least one active, visible marketplace listing.
 */
export async function fetchSellerProfileSitemapEntries(
  supabase: SupabaseClient,
): Promise<SellerProfileSitemapEntry[]> {
  const [{ data: shopRows, error: shopIdsError }, { data: listingRows, error: listingIdsError }] =
    await Promise.all([
      supabase.from("profiles").select("id").eq("is_shop", true),
      supabase
        .from("listings")
        .select("user_id")
        .eq("status", "active")
        .eq("hidden_from_site", false)
        .is("archived_at", null),
    ])

  if (shopIdsError) console.error("[sitemap] seller profiles (shops):", shopIdsError.message)
  if (listingIdsError) console.error("[sitemap] seller profiles (listing sellers):", listingIdsError.message)

  const sellerIdSet = new Set<string>()
  for (const row of shopRows ?? []) sellerIdSet.add(row.id as string)
  for (const row of listingRows ?? []) sellerIdSet.add(row.user_id as string)
  const sellerIds = [...sellerIdSet]

  if (sellerIds.length === 0) return []

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("seller_slug, updated_at")
    .in("id", sellerIds)
    .not("seller_slug", "is", null)

  if (error) {
    console.error("[sitemap] seller profiles:", error.message)
    return []
  }

  const out: SellerProfileSitemapEntry[] = []
  for (const row of profiles ?? []) {
    const slug = typeof row.seller_slug === "string" ? row.seller_slug.trim() : ""
    if (!slug) continue
    const lm =
      typeof row.updated_at === "string" && row.updated_at ? new Date(row.updated_at) : new Date()
    out.push({ path: `/sellers/${slug}`, lastModified: lm })
  }

  return out
}

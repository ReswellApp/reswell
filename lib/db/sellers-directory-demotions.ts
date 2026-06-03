import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchSellersDirectoryEligibleSellerIds } from "@/lib/sellers/directory-eligibility"

const PROFILE_PICK_FIELDS =
  "id, seller_slug, display_name, shop_name, shop_logo_url, avatar_url, city, shop_address, is_shop, shop_verified" as const

function escapeIlikeToken(q: string) {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export async function listSellersDirectoryDemotedProfileIdsOrdered(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("sellers_directory_demotions")
    .select("profile_id")
    .order("created_at", { ascending: true })

  if (error) {
    console.error("listSellersDirectoryDemotedProfileIdsOrdered:", error.message)
    return []
  }
  return (data ?? []).map((r) => r.profile_id as string)
}

export async function readDemotedProfileIdSet(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = await listSellersDirectoryDemotedProfileIdsOrdered(supabase)
  return new Set(ids)
}

export type SellerDemotionAdminRow = {
  profile_id: string
  created_at: string
  seller_slug: string
  display_name: string | null
  shop_name: string | null
  shop_logo_url: string | null
  avatar_url: string | null
}

export async function listSellersDirectoryDemotionsForAdmin(
  supabase: SupabaseClient,
): Promise<SellerDemotionAdminRow[]> {
  const { data: demRows, error: dErr } = await supabase
    .from("sellers_directory_demotions")
    .select("profile_id, created_at")
    .order("created_at", { ascending: true })

  if (dErr) {
    console.error("listSellersDirectoryDemotionsForAdmin (demotions):", dErr.message)
    return []
  }
  if (!demRows?.length) return []

  const ids = demRows.map((r) => r.profile_id as string)
  const { data: profs, error: pErr } = await supabase
    .from("profiles")
    .select(PROFILE_PICK_FIELDS)
    .in("id", ids)

  if (pErr) {
    console.error("listSellersDirectoryDemotionsForAdmin (profiles):", pErr.message)
    return []
  }

  const byId = new Map(
    (profs ?? []).map((p) => [
      p.id as string,
      p as {
        id: string
        seller_slug: string | null
        display_name: string | null
        shop_name: string | null
        shop_logo_url: string | null
        avatar_url: string | null
      },
    ]),
  )

  const out: SellerDemotionAdminRow[] = []
  for (const d of demRows) {
    const pid = d.profile_id as string
    const p = byId.get(pid)
    if (!p || !p.seller_slug?.trim()) continue
    out.push({
      profile_id: pid,
      created_at: d.created_at as string,
      seller_slug: p.seller_slug.trim(),
      display_name: p.display_name ?? null,
      shop_name: p.shop_name ?? null,
      shop_logo_url: p.shop_logo_url ?? null,
      avatar_url: p.avatar_url ?? null,
    })
  }
  return out
}

export type SellerDemotionSearchHit = {
  id: string
  seller_slug: string
  display_name: string | null
  shop_name: string | null
  shop_logo_url: string | null
  avatar_url: string | null
  city: string | null
  shop_address: string | null
  shop_verified: boolean
  already_demoted: boolean
}

/**
 * Same seller eligibility as `/sellers` + search actions (see `directory-eligibility`).
 */
export async function searchProfilesForSellersDirectoryDemotionPicker(
  supabase: SupabaseClient,
  qRaw: string,
  limit: number,
): Promise<SellerDemotionSearchHit[]> {
  const q = (qRaw || "").trim().replace(/%/g, "")
  if (q.length < 1) return []

  const safe = escapeIlikeToken(q)
  const pattern = `"%${safe}%"`

  const { sellerIds: eligibleSellerIds } =
    await fetchSellersDirectoryEligibleSellerIds(supabase)

  if (eligibleSellerIds.length === 0) return []

  const cap = Math.min(Math.max(limit, 1), 500)

  const [{ data: matchRows, error: matchErr }, demotedSet] = await Promise.all([
    supabase
      .from("profiles")
      .select(PROFILE_PICK_FIELDS)
      .in("id", eligibleSellerIds)
      .or(
        `shop_name.ilike.${pattern},display_name.ilike.${pattern},seller_slug.ilike.${pattern},city.ilike.${pattern},shop_address.ilike.${pattern}`,
      )
      .order("shop_verified", { ascending: false })
      .order("is_shop", { ascending: false })
      .limit(cap),
    readDemotedProfileIdSet(supabase),
  ])

  if (matchErr || !matchRows) {
    if (matchErr) console.error("searchProfilesForSellersDirectoryDemotionPicker:", matchErr.message)
    return []
  }

  return (matchRows as Record<string, unknown>[])
    .map((row) => {
      const sellerSlug = ((row.seller_slug as string | null) ?? "").trim()
      if (!sellerSlug) return null
      const id = row.id as string
      return {
        id,
        seller_slug: sellerSlug,
        display_name: (row.display_name as string | null) ?? null,
        shop_name: (row.shop_name as string | null) ?? null,
        shop_logo_url: (row.shop_logo_url as string | null) ?? null,
        avatar_url: (row.avatar_url as string | null) ?? null,
        city: (row.city as string | null) ?? null,
        shop_address: (row.shop_address as string | null) ?? null,
        shop_verified: Boolean(row.shop_verified),
        already_demoted: demotedSet.has(id),
      } satisfies SellerDemotionSearchHit
    })
    .filter((r): r is SellerDemotionSearchHit => r != null)
}

export type InsertSellersDirectoryDemotionResult =
  | { ok: true }
  | { ok: false; error: string; alreadyDemoted?: boolean }

export async function insertSellersDirectoryDemotion(
  supabase: SupabaseClient,
  profileId: string,
): Promise<InsertSellersDirectoryDemotionResult> {
  const existing = await supabase
    .from("sellers_directory_demotions")
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle()

  if (existing.error) {
    console.error("insertSellersDirectoryDemotion (lookup):", existing.error.message)
    return { ok: false, error: existing.error.message || "Lookup failed" }
  }
  if (existing.data?.profile_id) {
    return {
      ok: false,
      error: "That seller is already demoted in the directory",
      alreadyDemoted: true,
    }
  }

  const { error } = await supabase.from("sellers_directory_demotions").insert({ profile_id: profileId })
  if (error) {
    console.error("insertSellersDirectoryDemotion (insert):", error.message)
    return { ok: false, error: error.message || "Insert failed" }
  }
  return { ok: true }
}

export async function deleteSellersDirectoryDemotionByProfileId(
  supabase: SupabaseClient,
  profileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("sellers_directory_demotions")
    .delete()
    .eq("profile_id", profileId)
    .select("profile_id")

  if (error) {
    console.error("deleteSellersDirectoryDemotionByProfileId:", error.message)
    return { ok: false, error: error.message || "Delete failed" }
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "No row deleted (seller not demoted?)" }
  }
  return { ok: true }
}

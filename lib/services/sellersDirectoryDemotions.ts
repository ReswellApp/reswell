import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  deleteSellersDirectoryDemotionByProfileId,
  insertSellersDirectoryDemotion,
  listSellersDirectoryDemotionsForAdmin,
  searchProfilesForSellersDirectoryDemotionPicker,
  type SellerDemotionAdminRow,
  type SellerDemotionSearchHit,
} from "@/lib/db/sellers-directory-demotions"

export type { SellerDemotionAdminRow, SellerDemotionSearchHit }

export async function listSellersDirectoryDemotionsAdminService(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: SellerDemotionAdminRow[] } | { ok: false; error: string }> {
  try {
    const rows = await listSellersDirectoryDemotionsForAdmin(supabase)
    return { ok: true, rows }
  } catch {
    return { ok: false, error: "Could not load demoted sellers" }
  }
}

export async function addSellersDirectoryDemotionService(
  profileId: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("addSellersDirectoryDemotionService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const { data: profile, error } = await svc.from("profiles").select("id").eq("id", profileId).maybeSingle()
  if (error) {
    console.error("addSellersDirectoryDemotionService (profile lookup):", error.message)
    return { ok: false, error: "Could not verify profile", status: 500 }
  }
  if (!profile) {
    return { ok: false, error: "Profile not found", status: 404 }
  }

  const result = await insertSellersDirectoryDemotion(svc, profileId)
  if (!result.ok) {
    const status = result.alreadyDemoted ? 409 : 500
    return { ok: false, error: result.error, status }
  }
  return { ok: true }
}

export async function removeSellersDirectoryDemotionService(
  profileId: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("removeSellersDirectoryDemotionService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const result = await deleteSellersDirectoryDemotionByProfileId(svc, profileId)
  if (!result.ok) {
    const isNotFound = /No row deleted/i.test(result.error)
    return { ok: false, error: result.error, status: isNotFound ? 404 : 500 }
  }
  return { ok: true }
}

export async function searchSellersDirectoryDemotionPickerService(
  query: string,
  limit: number,
): Promise<{ ok: true; hits: SellerDemotionSearchHit[] } | { ok: false; error: string }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("searchSellersDirectoryDemotionPickerService: missing service role", e)
    return { ok: false, error: "Server configuration error" }
  }
  try {
    const hits = await searchProfilesForSellersDirectoryDemotionPicker(svc, query, limit)
    return { ok: true, hits }
  } catch (e) {
    console.error("searchSellersDirectoryDemotionPickerService:", e)
    return { ok: false, error: "Could not search sellers" }
  }
}

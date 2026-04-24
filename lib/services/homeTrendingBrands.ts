import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  deleteHomeTrendingBrandRow,
  insertHomeTrendingBrand,
  listHomeTrendingBrandRows,
  searchBrandsForTrendingPicker,
  type HomeTrendingBrandRow,
  type HomeTrendingBrandSearchHit,
} from "@/lib/db/home-trending-brands"

export type { HomeTrendingBrandRow, HomeTrendingBrandSearchHit }

export async function addHomeTrendingBrandService(
  brandId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("addHomeTrendingBrandService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const { data: brand, error } = await svc.from("brands").select("id").eq("id", brandId).maybeSingle()

  if (error) {
    console.error("addHomeTrendingBrandService (brand lookup):", error.message)
    return { ok: false, error: "Could not verify brand", status: 500 }
  }
  if (!brand) {
    return { ok: false, error: "Brand not found", status: 404 }
  }

  const result = await insertHomeTrendingBrand(svc, brandId)
  if (!result.ok) {
    const status = result.alreadyExists ? 409 : 500
    return { ok: false, error: result.error, status }
  }
  return { ok: true, id: result.id }
}

export async function listHomeTrendingBrandsForAdminService(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: HomeTrendingBrandRow[] } | { ok: false; error: string }> {
  try {
    const rows = await listHomeTrendingBrandRows(supabase)
    return { ok: true, rows }
  } catch {
    return { ok: false, error: "Could not load trending brands" }
  }
}

export async function listHomeTrendingBrandsForPublicService(
  supabase: SupabaseClient,
): Promise<HomeTrendingBrandRow[]> {
  return listHomeTrendingBrandRows(supabase)
}

export async function deleteHomeTrendingBrandService(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("deleteHomeTrendingBrandService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const result = await deleteHomeTrendingBrandRow(svc, id)
  if (!result.ok) {
    const isNotFound = /no row deleted|not found/i.test(result.error)
    return { ok: false, error: result.error, status: isNotFound ? 404 : 500 }
  }
  return { ok: true }
}

export async function searchTrendingBrandsPickerService(
  supabase: SupabaseClient,
  query: string,
  limit: number,
): Promise<{ ok: true; hits: HomeTrendingBrandSearchHit[] } | { ok: false; error: string }> {
  try {
    const hits = await searchBrandsForTrendingPicker(supabase, query, limit)
    return { ok: true, hits }
  } catch (e) {
    console.error("searchTrendingBrandsPickerService:", e)
    return { ok: false, error: "Could not search brands" }
  }
}

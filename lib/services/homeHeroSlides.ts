import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  deleteHomeHeroImageRow,
  insertHomeHeroImage,
  listHomeHeroImageRows,
  type HomeHeroImageRow,
} from "@/lib/db/home-hero-images"

/**
 * Inserts using the service role after the route verifies admin, so RLS on `public.images`
 * cannot block the insert (common cause of "Could not save hero slide").
 */
export async function addHomeHeroSlideService(
  imageUrl: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("addHomeHeroSlideService: missing service role", e)
    return { ok: false, error: "Server configuration error" }
  }
  return insertHomeHeroImage(svc, imageUrl)
}

export async function listHomeHeroSlidesForAdminService(
  supabase: SupabaseClient,
): Promise<{ ok: true; slides: HomeHeroImageRow[] } | { ok: false; error: string }> {
  try {
    const slides = await listHomeHeroImageRows(supabase)
    return { ok: true, slides }
  } catch {
    return { ok: false, error: "Could not load hero slides" }
  }
}

/**
 * Deletes by primary key after admin is verified on the route. Uses the service role
 * so RLS policies on `public.images` cannot block a legitimate admin delete.
 */
export async function deleteHomeHeroSlideService(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("deleteHomeHeroSlideService: missing service role", e)
    return { ok: false, error: "Server configuration error" }
  }
  return deleteHomeHeroImageRow(svc, id)
}

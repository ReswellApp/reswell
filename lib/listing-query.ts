import { SupabaseClient } from "@supabase/supabase-js"
import { isUUID } from "@/lib/slugify"

/**
 * Look up a listing by its slug (preferred) or UUID (backward compat).
 * Returns { listing, redirectSlug } where redirectSlug is set when the caller
 * used a UUID and should 301-redirect to the canonical slug URL.
 */
export async function findListingByParam(
  supabase: SupabaseClient,
  param: string,
  {
    select,
    section,
  }: {
    select: string
    section?: string
  },
): Promise<{ listing: any | null; redirectSlug: string | null }> {
  if (isUUID(param)) {
    let q = supabase.from("listings").select(select).eq("id", param)
    if (section) q = q.eq("section", section)
    const { data } = await q.single()
    if (!data) return { listing: null, redirectSlug: null }
    return {
      listing: data,
      redirectSlug: (data as any).slug || null,
    }
  }

  let q = supabase.from("listings").select(select).eq("slug", param)
  if (section) q = q.eq("section", section)
  const { data } = await q.single()
  return { listing: data, redirectSlug: null }
}

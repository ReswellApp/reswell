import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrandRow } from "@/lib/brands/types"

export async function listBrands(
  supabase: SupabaseClient,
): Promise<BrandRow[]> {
  const { data, error } = await supabase
    .from("brands")
    .select(
      "id, slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs",
    )
    .order("name", { ascending: true })

  if (error) {
    console.error("listBrands:", error.message)
    return []
  }
  return (data ?? []) as BrandRow[]
}

export async function getBrandBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<BrandRow | null> {
  const { data, error } = await supabase
    .from("brands")
    .select(
      "id, slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs",
    )
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    console.error("getBrandBySlug:", error.message)
    return null
  }
  return (data as BrandRow | null) ?? null
}

export async function getBrandById(
  supabase: SupabaseClient,
  id: string,
): Promise<BrandRow | null> {
  const { data, error } = await supabase
    .from("brands")
    .select(
      "id, slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs",
    )
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("getBrandById:", error.message)
    return null
  }
  return (data as BrandRow | null) ?? null
}

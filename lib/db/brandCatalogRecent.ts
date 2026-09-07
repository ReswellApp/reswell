import type { SupabaseClient } from "@supabase/supabase-js"

export type RecentCatalogBrandRow = {
  id: string
  slug: string
  name: string
  logo_url: string | null
  model_count: number
  created_at: string
}

export type RecentCatalogModelRow = {
  id: string
  name: string
  created_at: string
  brand: { id: string; name: string; slug: string }
}

async function countCreatedSince(
  supabase: SupabaseClient,
  table: "brands" | "brand_models",
  sinceIso: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .gte("created_at", sinceIso)

  if (error) {
    console.error(`countCreatedSince ${table}:`, error.message)
    return 0
  }
  return count ?? 0
}

export async function countBrandsCreatedSince(
  supabase: SupabaseClient,
  sinceIso: string,
): Promise<number> {
  return countCreatedSince(supabase, "brands", sinceIso)
}

export async function countBrandModelsCreatedSince(
  supabase: SupabaseClient,
  sinceIso: string,
): Promise<number> {
  return countCreatedSince(supabase, "brand_models", sinceIso)
}

export async function listBrandsCreatedSince(
  supabase: SupabaseClient,
  sinceIso: string,
  limit: number,
): Promise<RecentCatalogBrandRow[]> {
  const { data, error } = await supabase
    .from("brands")
    .select("id, slug, name, logo_url, model_count, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("listBrandsCreatedSince:", error.message)
    return []
  }
  return (data ?? []) as RecentCatalogBrandRow[]
}

export async function listBrandModelsCreatedSince(
  supabase: SupabaseClient,
  sinceIso: string,
  limit: number,
): Promise<RecentCatalogModelRow[]> {
  const { data, error } = await supabase
    .from("brand_models")
    .select("id, name, created_at, brands:brand_id ( id, name, slug )")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("listBrandModelsCreatedSince:", error.message)
    return []
  }

  const out: RecentCatalogModelRow[] = []
  for (const row of data ?? []) {
    const raw = row as {
      id: string
      name: string
      created_at: string
      brands: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null
    }
    const brand = Array.isArray(raw.brands) ? raw.brands[0] ?? null : raw.brands
    if (!brand?.id) continue
    out.push({
      id: raw.id,
      name: raw.name,
      created_at: raw.created_at,
      brand: { id: brand.id, name: brand.name, slug: brand.slug },
    })
  }
  return out
}

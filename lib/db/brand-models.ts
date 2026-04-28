import type { SupabaseClient } from "@supabase/supabase-js"

export type BrandModelRow = {
  id: string
  brand_id: string
  name: string
  description: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

export type BrandModelAdminRow = BrandModelRow & {
  brand: { id: string; name: string; slug: string }
}

type RawBrandModelRow = BrandModelRow & {
  brands:
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null
}

function pickJoinedBrand(
  joined: RawBrandModelRow["brands"],
): { id: string; name: string; slug: string } | null {
  if (!joined) return null
  return Array.isArray(joined) ? joined[0] ?? null : joined
}

const LIST_SELECT = `
  id,
  brand_id,
  name,
  description,
  image_url,
  created_at,
  updated_at,
  brands:brand_id ( id, name, slug )
`

/** Public catalog rows for sell-flow model picker (`brand_models` only — not variants). */
export async function listBrandModelsForPublicCatalogByBrandId(
  supabase: SupabaseClient,
  brandId: string,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("brand_models")
    .select("id, name")
    .eq("brand_id", brandId)
    .order("name", { ascending: true })

  if (error) {
    console.error("listBrandModelsForPublicCatalogByBrandId:", error.message)
    return []
  }
  return ((data ?? []) as { id: string; name: string }[]).map((r) => ({
    id: r.id,
    name: r.name.trim(),
  }))
}

/** Brand slug + `brand_models` rows for the sell form (no variants). */
export async function getBrandModelsCatalogOptionsForSell(
  supabase: SupabaseClient,
  brandId: string,
): Promise<
  | { ok: true; brandSlug: string; models: { id: string; name: string }[] }
  | { ok: false; error: string }
> {
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("slug")
    .eq("id", brandId)
    .maybeSingle()

  if (brandError) {
    console.error("getBrandModelsCatalogOptionsForSell (brand):", brandError.message)
    return { ok: false, error: "Could not load brand" }
  }
  if (!brand?.slug?.trim()) {
    return { ok: false, error: "Brand not found" }
  }

  const models = await listBrandModelsForPublicCatalogByBrandId(supabase, brandId)
  return { ok: true, brandSlug: brand.slug.trim(), models }
}

export async function listBrandModelsForAdmin(
  supabase: SupabaseClient,
  brandId?: string,
): Promise<BrandModelAdminRow[]> {
  let q = supabase.from("brand_models").select(LIST_SELECT).order("name", { ascending: true })

  if (brandId) {
    q = q.eq("brand_id", brandId)
  }

  const { data, error } = await q

  if (error) {
    console.error("listBrandModelsForAdmin:", error.message)
    return []
  }

  const rows = (data ?? []) as RawBrandModelRow[]
  const out: BrandModelAdminRow[] = []
  for (const row of rows) {
    const b = pickJoinedBrand(row.brands)
    if (!b?.id) continue
    out.push({
      id: row.id,
      brand_id: row.brand_id,
      name: row.name,
      description: row.description,
      image_url: row.image_url ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      brand: { id: b.id, name: b.name, slug: b.slug },
    })
  }
  return out
}

export async function insertBrandModel(
  supabase: SupabaseClient,
  input: {
    brand_id: string
    name: string
    description: string | null
    image_url: string | null
  },
): Promise<{ ok: true; row: BrandModelRow } | { ok: false; error: string; code?: string }> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("brand_models")
    .insert({
      brand_id: input.brand_id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      image_url: input.image_url,
      updated_at: now,
    })
    .select("id, brand_id, name, description, image_url, created_at, updated_at")
    .single()

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A model with this name already exists for that brand", code: error.code }
    }
    if (error.code === "23503") {
      return { ok: false, error: "Brand not found", code: error.code }
    }
    console.error("insertBrandModel:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, row: data as BrandModelRow }
}

export async function updateBrandModel(
  supabase: SupabaseClient,
  id: string,
  patch: {
    name?: string
    description?: string | null
    brand_id?: string
    image_url?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) updates.name = patch.name.trim()
  if (patch.description !== undefined) updates.description = patch.description?.trim() || null
  if (patch.brand_id !== undefined) updates.brand_id = patch.brand_id
  if (patch.image_url !== undefined) updates.image_url = patch.image_url

  const { error } = await supabase.from("brand_models").update(updates).eq("id", id)

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A model with this name already exists for that brand", code: error.code }
    }
    if (error.code === "23503") {
      return { ok: false, error: "Brand not found", code: error.code }
    }
    console.error("updateBrandModel:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function deleteBrandModel(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.from("brand_models").delete().eq("id", id).select("id")

  if (error) {
    console.error("deleteBrandModel:", error.message)
    return { ok: false, error: error.message }
  }
  if (!data?.length) {
    return { ok: false, error: "Model not found" }
  }
  return { ok: true }
}

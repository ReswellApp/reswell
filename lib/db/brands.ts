import type { SupabaseClient } from "@supabase/supabase-js"

export type InsertDirectoryBrandInput = {
  slug: string
  name: string
  short_description: string | null
  website_url: string | null
  founder_name: string | null
  lead_shaper_name: string | null
  location_label: string | null
}

export type InsertedDirectoryBrand = {
  id: string
  slug: string
  name: string
}

/** Insert a directory brand. Does not overwrite existing rows — caller must look up first. */
export async function insertDirectoryBrand(
  supabase: SupabaseClient,
  input: InsertDirectoryBrandInput,
): Promise<
  | { ok: true; row: InsertedDirectoryBrand }
  | { ok: false; error: string; code?: string }
> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("brands")
    .insert({
      slug: input.slug,
      name: input.name.trim(),
      short_description: input.short_description,
      website_url: input.website_url,
      logo_url: null,
      founder_name: input.founder_name,
      lead_shaper_name: input.lead_shaper_name,
      location_label: input.location_label,
      model_count: 0,
      about_paragraphs: [],
      updated_at: now,
    })
    .select("id, slug, name")
    .single()

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A brand with this slug already exists", code: error.code }
    }
    console.error("insertDirectoryBrand:", error.message)
    return { ok: false, error: error.message, code: error.code }
  }

  return {
    ok: true,
    row: {
      id: data.id,
      slug: data.slug,
      name: data.name.trim(),
    },
  }
}

/** Fill empty website/location/founder only — never replace populated catalog fields. */
export async function fillEmptyDirectoryBrandFields(
  supabase: SupabaseClient,
  brandId: string,
  patch: {
    website_url?: string | null
    location_label?: string | null
    founder_name?: string | null
    short_description?: string | null
  },
): Promise<void> {
  const { data: current, error: readError } = await supabase
    .from("brands")
    .select("website_url, location_label, founder_name, short_description")
    .eq("id", brandId)
    .maybeSingle()

  if (readError || !current) {
    if (readError) console.error("fillEmptyDirectoryBrandFields read:", readError.message)
    return
  }

  const next = {
    website_url: current.website_url || patch.website_url || null,
    location_label: current.location_label || patch.location_label || null,
    founder_name: current.founder_name || patch.founder_name || null,
    short_description: current.short_description || patch.short_description || null,
    updated_at: new Date().toISOString(),
  }

  const changed =
    next.website_url !== (current.website_url || null) ||
    next.location_label !== (current.location_label || null) ||
    next.founder_name !== (current.founder_name || null) ||
    next.short_description !== (current.short_description || null)

  if (!changed) return

  const { error } = await supabase.from("brands").update(next).eq("id", brandId)
  if (error) {
    console.error("fillEmptyDirectoryBrandFields:", error.message)
  }
}

export async function deleteDirectoryBrand(
  supabase: SupabaseClient,
  brandId: string,
): Promise<void> {
  const { error } = await supabase.from("brands").delete().eq("id", brandId)
  if (error) {
    console.error("deleteDirectoryBrand:", error.message)
  }
}

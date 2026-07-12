import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  FbMarketplaceCatalogInsertInput,
  FbMarketplaceCatalogUpdateInput,
} from "@/lib/validations/fb-marketplace-catalog"

export type FbMarketplaceCatalogRow = {
  id: string
  name: string
  price: number | null
  location: string | null
  image_url: string | null
  condition: string | null
  description: string | null
  source_url: string | null
  converted_brand_model_variant_id: string | null
  converted_at: string | null
  dismissed_at: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
}

const SELECT_ADMIN =
  "id, name, price, location, image_url, condition, description, source_url, converted_brand_model_variant_id, converted_at, dismissed_at, admin_notes, created_at, updated_at"

function normalizeNullableMoney(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeRow(raw: Record<string, unknown>): FbMarketplaceCatalogRow {
  return {
    ...(raw as Omit<FbMarketplaceCatalogRow, "price">),
    price: normalizeNullableMoney(raw.price),
  }
}

function toInsertRow(input: FbMarketplaceCatalogInsertInput): Record<string, unknown> {
  return {
    name: input.name.trim(),
    price: input.price,
    location: input.location,
    image_url: input.image_url,
    condition: input.condition,
    description: input.description,
    source_url: input.source_url,
    admin_notes: input.admin_notes,
  }
}

export async function listFbMarketplaceCatalogForAdmin(
  supabase: SupabaseClient,
  options?: { pendingOnly?: boolean },
): Promise<
  | { ok: true; rows: FbMarketplaceCatalogRow[] }
  | { ok: false; error: string }
> {
  let query = supabase
    .from("fb_marketplace_catalog")
    .select(SELECT_ADMIN)
    .order("created_at", { ascending: false })

  if (options?.pendingOnly) {
    query = query.is("converted_at", null).is("dismissed_at", null)
  }

  const { data, error } = await query

  if (error) {
    console.error("listFbMarketplaceCatalogForAdmin:", error.message)
    return { ok: false, error: error.message }
  }

  const rows = (data ?? []).map((r) => normalizeRow(r as Record<string, unknown>))
  return { ok: true, rows }
}

export async function getFbMarketplaceCatalogById(
  supabase: SupabaseClient,
  id: string,
): Promise<
  | { ok: true; row: FbMarketplaceCatalogRow }
  | { ok: false; error: string }
> {
  const { data, error } = await supabase
    .from("fb_marketplace_catalog")
    .select(SELECT_ADMIN)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("getFbMarketplaceCatalogById:", error.message)
    return { ok: false, error: error.message }
  }
  if (!data) return { ok: false, error: "Not found." }

  return { ok: true, row: normalizeRow(data as Record<string, unknown>) }
}

export async function insertFbMarketplaceCatalogRow(
  supabase: SupabaseClient,
  input: FbMarketplaceCatalogInsertInput,
): Promise<
  | { ok: true; row: FbMarketplaceCatalogRow }
  | { ok: false; error: string }
> {
  const { data, error } = await supabase
    .from("fb_marketplace_catalog")
    .insert(toInsertRow(input))
    .select(SELECT_ADMIN)
    .single()

  if (error) {
    console.error("insertFbMarketplaceCatalogRow:", error.message)
    return { ok: false, error: error.message }
  }

  return { ok: true, row: normalizeRow(data as Record<string, unknown>) }
}

export async function insertFbMarketplaceCatalogRows(
  supabase: SupabaseClient,
  inputs: FbMarketplaceCatalogInsertInput[],
): Promise<
  | { ok: true; rows: FbMarketplaceCatalogRow[]; insertedCount: number }
  | { ok: false; error: string }
> {
  if (!inputs.length) return { ok: false, error: "No rows to insert." }

  const { data, error } = await supabase
    .from("fb_marketplace_catalog")
    .insert(inputs.map(toInsertRow))
    .select(SELECT_ADMIN)

  if (error) {
    console.error("insertFbMarketplaceCatalogRows:", error.message)
    return { ok: false, error: error.message }
  }

  const rows = (data ?? []).map((r) => normalizeRow(r as Record<string, unknown>))
  return { ok: true, rows, insertedCount: rows.length }
}

export async function updateFbMarketplaceCatalogRow(
  supabase: SupabaseClient,
  id: string,
  input: FbMarketplaceCatalogUpdateInput,
): Promise<
  | { ok: true; row: FbMarketplaceCatalogRow }
  | { ok: false; error: string }
> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.price !== undefined) patch.price = input.price
  if (input.location !== undefined) patch.location = input.location
  if (input.image_url !== undefined) patch.image_url = input.image_url
  if (input.condition !== undefined) patch.condition = input.condition
  if (input.description !== undefined) patch.description = input.description
  if (input.source_url !== undefined) patch.source_url = input.source_url
  if (input.admin_notes !== undefined) patch.admin_notes = input.admin_notes
  if (input.dismissed_at !== undefined) patch.dismissed_at = input.dismissed_at
  if (input.converted_brand_model_variant_id !== undefined) {
    patch.converted_brand_model_variant_id = input.converted_brand_model_variant_id
  }
  if (input.converted_at !== undefined) patch.converted_at = input.converted_at

  const { data, error } = await supabase
    .from("fb_marketplace_catalog")
    .update(patch)
    .eq("id", id)
    .select(SELECT_ADMIN)
    .single()

  if (error) {
    console.error("updateFbMarketplaceCatalogRow:", error.message)
    return { ok: false, error: error.message }
  }

  return { ok: true, row: normalizeRow(data as Record<string, unknown>) }
}

export async function deleteFbMarketplaceCatalogRow(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("fb_marketplace_catalog").delete().eq("id", id)

  if (error) {
    console.error("deleteFbMarketplaceCatalogRow:", error.message)
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

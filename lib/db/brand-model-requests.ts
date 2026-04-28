import type { SupabaseClient } from "@supabase/supabase-js"

export type BrandModelRequestAdminRow = {
  id: string
  user_id: string
  brand_id: string
  requested_model_name: string
  notes: string | null
  created_at: string
  brand_name: string | null
  brand_slug: string | null
}

type RawBrandModelRequestRow = {
  id: string
  user_id: string
  brand_id: string
  requested_model_name: string
  notes: string | null
  created_at: string
  brands:
    | { name: string; slug: string }
    | { name: string; slug: string }[]
    | null
}

function pickJoinedBrand(
  joined: RawBrandModelRequestRow["brands"],
): { name: string; slug: string } | null {
  if (!joined) return null
  const row = Array.isArray(joined) ? joined[0] ?? null : joined
  if (!row?.name?.trim()) return null
  return { name: row.name.trim(), slug: row.slug?.trim() ?? "" }
}

/** Staff/admin queue: seller-submitted model names for existing brands. */
export async function listBrandModelRequestsForAdmin(
  supabase: SupabaseClient,
): Promise<
  | { ok: true; rows: BrandModelRequestAdminRow[] }
  | { ok: false; error: string }
> {
  const { data, error } = await supabase
    .from("brand_model_requests")
    .select(
      `
      id,
      user_id,
      brand_id,
      requested_model_name,
      notes,
      created_at,
      brands:brand_id ( name, slug )
    `,
    )
    .order("created_at", { ascending: false })

  if (error) {
    console.error("listBrandModelRequestsForAdmin:", error.message)
    return { ok: false, error: error.message }
  }

  const rows = (data ?? []) as RawBrandModelRequestRow[]
  const out = rows.map((r) => {
    const b = pickJoinedBrand(r.brands)
    return {
      id: r.id,
      user_id: r.user_id,
      brand_id: r.brand_id,
      requested_model_name: r.requested_model_name?.trim() ?? "",
      notes: r.notes?.trim() ? r.notes.trim() : null,
      created_at: r.created_at,
      brand_name: b?.name ?? null,
      brand_slug: b?.slug ? b.slug : null,
    }
  })
  return { ok: true, rows: out }
}

export async function insertBrandModelRequest(
  supabase: SupabaseClient,
  input: {
    userId: string
    brandId: string
    requestedModelName: string
    notes: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("brand_model_requests").insert({
    user_id: input.userId,
    brand_id: input.brandId,
    requested_model_name: input.requestedModelName.trim(),
    notes: input.notes?.trim() || null,
  })

  if (error) {
    console.error("insertBrandModelRequest:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

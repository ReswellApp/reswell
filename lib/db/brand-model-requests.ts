import type { SupabaseClient } from "@supabase/supabase-js"

export type BrandModelRequestAdminRow = {
  id: string
  user_id: string
  brand_id: string | null
  requested_model_name: string
  notes: string | null
  created_at: string
  brand_name: string | null
  brand_slug: string | null
  /** Present when submitted without `brand_id`; same info as listing free-text brand field. */
  seller_brand_name: string | null
}

type RawBrandModelRequestRow = {
  id: string
  user_id: string
  brand_id: string | null
  requested_model_name: string
  notes: string | null
  created_at: string
  seller_brand_name: string | null
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

/** Staff/admin queue: seller-submitted model catalog requests (directory brand and/or typed brand label). */
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
      seller_brand_name,
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
    const sellerName = r.seller_brand_name?.trim() ? r.seller_brand_name.trim() : null
    return {
      id: r.id,
      user_id: r.user_id,
      brand_id: r.brand_id,
      requested_model_name: r.requested_model_name?.trim() ?? "",
      notes: r.notes?.trim() ? r.notes.trim() : null,
      created_at: r.created_at,
      brand_name: b?.name ?? sellerName,
      brand_slug: b?.slug ? b.slug : null,
      seller_brand_name: sellerName,
    }
  })
  return { ok: true, rows: out }
}

export async function insertBrandModelRequest(
  supabase: SupabaseClient,
  input:
    | {
        userId: string
        brandId: string
        sellerBrandName?: undefined
        requestedModelName: string
        notes: string | null
      }
    | {
        userId: string
        brandId?: undefined
        sellerBrandName: string
        requestedModelName: string
        notes: string | null
      },
): Promise<{ ok: true } | { ok: false; error: string }> {
  let row:
    | { user_id: string; brand_id: string | null; seller_brand_name: string | null; requested_model_name: string; notes: string | null }
    | null = null

  if ("brandId" in input && input.brandId) {
    row = {
      user_id: input.userId,
      brand_id: input.brandId,
      seller_brand_name: null,
      requested_model_name: input.requestedModelName.trim(),
      notes: input.notes?.trim() || null,
    }
  } else if ("sellerBrandName" in input && input.sellerBrandName?.trim()) {
    row = {
      user_id: input.userId,
      brand_id: null,
      seller_brand_name: input.sellerBrandName.trim(),
      requested_model_name: input.requestedModelName.trim(),
      notes: input.notes?.trim() || null,
    }
  }

  if (!row) {
    return { ok: false, error: "Missing brand linking or seller brand label." }
  }

  const { error } = await supabase.from("brand_model_requests").insert(row)

  if (error) {
    console.error("insertBrandModelRequest:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

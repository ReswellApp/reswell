import type { SupabaseClient } from "@supabase/supabase-js"

/** Rows in `public.images` with this scope power the homepage hero (after default static slides). */
export const HOME_HERO_IMAGE_SCOPE = "home_hero" as const

export interface HomeHeroImageRow {
  id: string
  url: string
  sort_order: number
}

/** Cached per server process — some projects never added a `scope` column. */
let imagesTableHasScopeColumn: boolean | null = null

function isMissingScopeColumnError(message: string): boolean {
  return /column.*\bscope\b.*does not exist|scope.*does not exist/i.test(message)
}

async function getImagesTableHasScopeColumn(supabase: SupabaseClient): Promise<boolean> {
  if (imagesTableHasScopeColumn !== null) return imagesTableHasScopeColumn

  const { error } = await supabase.from("images").select("scope").limit(1)
  if (error && isMissingScopeColumnError(error.message)) {
    imagesTableHasScopeColumn = false
    return false
  }
  imagesTableHasScopeColumn = true
  return true
}

function heroScopeOrLegacyNullFilter() {
  return `scope.eq.${HOME_HERO_IMAGE_SCOPE},scope.is.null`
}

export function normalizeImageRowId(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim()
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw)
  return ""
}

function pickUrl(row: {
  id: unknown
  url?: unknown
  image_url?: unknown
  sort_order?: unknown
}): { id: string; url: string; sort_order: number } | null {
  const id = normalizeImageRowId(row.id)
  const u = typeof row.url === "string" ? row.url.trim() : ""
  const legacy = typeof row.image_url === "string" ? row.image_url.trim() : ""
  const url = u || legacy
  const sort_order = typeof row.sort_order === "number" ? row.sort_order : 0
  if (!id || !url) return null
  return { id, url, sort_order }
}

async function selectHeroImageRows(
  supabase: SupabaseClient,
  hasScope: boolean,
): Promise<{ data: unknown[] | null; error: { message: string } | null }> {
  if (hasScope) {
    const res = await supabase
      .from("images")
      .select("id, url, image_url, sort_order")
      .or(heroScopeOrLegacyNullFilter())
      .order("sort_order", { ascending: true })
    if (res.error && /image_url|schema cache/i.test(res.error.message)) {
      const fallback = await supabase
        .from("images")
        .select("id, url, sort_order")
        .or(heroScopeOrLegacyNullFilter())
        .order("sort_order", { ascending: true })
      return fallback
    }
    return res
  }

  const wide = await supabase
    .from("images")
    .select("id, url, image_url, sort_order")
    .order("sort_order", { ascending: true })
  if (wide.error && /image_url|schema cache/i.test(wide.error.message)) {
    return await supabase.from("images").select("id, url, sort_order").order("sort_order", { ascending: true })
  }
  return wide
}

export async function listHomeHeroImageUrls(supabase: SupabaseClient): Promise<string[]> {
  const rows = await listHomeHeroImageRows(supabase)
  return rows.map((r) => r.url)
}

export async function listHomeHeroImageRows(supabase: SupabaseClient): Promise<HomeHeroImageRow[]> {
  const hasScope = await getImagesTableHasScopeColumn(supabase)
  const { data, error } = await selectHeroImageRows(supabase, hasScope)

  if (error) {
    console.error("listHomeHeroImageRows:", error.message)
    return []
  }

  return (data ?? [])
    .map((row) => pickUrl(row as Parameters<typeof pickUrl>[0]))
    .filter((r): r is HomeHeroImageRow => r !== null)
}

async function readMaxSortOrder(supabase: SupabaseClient, hasScope: boolean): Promise<number> {
  if (hasScope) {
    const r = await supabase
      .from("images")
      .select("sort_order")
      .or(heroScopeOrLegacyNullFilter())
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (r.error && !isMissingScopeColumnError(r.error.message)) {
      console.error("readMaxSortOrder (scoped):", r.error.message)
    }
    return typeof r.data?.sort_order === "number" ? r.data.sort_order : -1
  }
  const r = await supabase
    .from("images")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (r.error) console.error("readMaxSortOrder:", r.error.message)
  return typeof r.data?.sort_order === "number" ? r.data.sort_order : -1
}

export type InsertHomeHeroImageResult = { ok: true; id: string } | { ok: false; error: string }

async function insertPayloadOnce(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<InsertHomeHeroImageResult> {
  const { data, error } = await supabase.from("images").insert(payload).select("id").single()
  if (error) {
    return { ok: false, error: error.message || "Insert failed" }
  }
  if (!data) return { ok: false, error: "No row returned" }
  const newId = normalizeImageRowId(data.id)
  if (!newId) return { ok: false, error: "Invalid id in response" }
  return { ok: true, id: newId }
}

/**
 * Inserts a hero image row. Prefer a **service role** client so RLS on `public.images` cannot block admins.
 * Tries common `images` table shapes (`url` vs `image_url`, optional `sort_order` / `scope`).
 */
export async function insertHomeHeroImage(
  supabase: SupabaseClient,
  imageUrl: string,
): Promise<InsertHomeHeroImageResult> {
  let hasScope = await getImagesTableHasScopeColumn(supabase)

  const buildAttempts = (order: number): Record<string, unknown>[] => {
    const a: Record<string, unknown>[] = []
    if (hasScope) {
      a.push({ url: imageUrl, sort_order: order, scope: HOME_HERO_IMAGE_SCOPE })
    }
    a.push(
      { url: imageUrl, sort_order: order },
      { image_url: imageUrl, sort_order: order },
    )
    if (hasScope) {
      a.push({ image_url: imageUrl, sort_order: order, scope: HOME_HERO_IMAGE_SCOPE })
    }
    a.push({ url: imageUrl }, { image_url: imageUrl })
    return a
  }

  const runBatch = async (order: number): Promise<InsertHomeHeroImageResult> => {
    let lastError = "Could not insert row"
    for (const payload of buildAttempts(order)) {
      const r = await insertPayloadOnce(supabase, payload)
      if (r.ok) return r
      lastError = r.error
    }
    return { ok: false, error: lastError }
  }

  let maxOrder = await readMaxSortOrder(supabase, hasScope)
  let order = maxOrder + 1
  let result = await runBatch(order)

  if (!result.ok && hasScope && isMissingScopeColumnError(result.error)) {
    imagesTableHasScopeColumn = false
    hasScope = false
    maxOrder = await readMaxSortOrder(supabase, false)
    order = maxOrder + 1
    result = await runBatch(order)
  }

  if (!result.ok) {
    console.error("insertHomeHeroImage:", result.error)
  }
  return result
}

/**
 * Deletes a single `images` row by primary key. Call only after verifying the user is an admin.
 * No `scope` filter — avoids errors when the column does not exist; id is unique.
 */
export async function deleteHomeHeroImageRow(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.from("images").delete().eq("id", id).select("id")

  if (error) {
    console.error("deleteHomeHeroImageRow:", error.message)
    return { ok: false, error: error.message || "Delete failed" }
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "No row deleted (check id)" }
  }
  return { ok: true }
}

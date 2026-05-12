import type { SupabaseClient } from "@supabase/supabase-js"
import type { SurferRow } from "@/lib/surfers/types"
import { normalizeSurferQuiverItemsFromDb } from "@/lib/surfers/parse-surfer-quiver-items"

const SELECT =
  "id, slug, name, short_description, instagram_url, youtube_url, photo_url, location_label, about_paragraphs, quiver_items"

function mapSurferRow(data: Record<string, unknown>): SurferRow {
  return {
    id: String(data.id ?? ""),
    slug: String(data.slug ?? ""),
    name: String(data.name ?? ""),
    short_description: (data.short_description as string | null) ?? null,
    instagram_url: (data.instagram_url as string | null) ?? null,
    youtube_url: (data.youtube_url as string | null) ?? null,
    photo_url: (data.photo_url as string | null) ?? null,
    location_label: (data.location_label as string | null) ?? null,
    about_paragraphs: Array.isArray(data.about_paragraphs)
      ? (data.about_paragraphs as string[])
      : [],
    quiver_items: normalizeSurferQuiverItemsFromDb(data.quiver_items),
  }
}

export async function listSurfers(supabase: SupabaseClient): Promise<SurferRow[]> {
  const { data, error } = await supabase.from("surfers").select(SELECT).order("name", { ascending: true })

  if (error) {
    console.error("listSurfers:", error.message)
    return []
  }
  return (data ?? []).map((row) => mapSurferRow(row as Record<string, unknown>))
}

export async function getSurferBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<SurferRow | null> {
  const { data, error } = await supabase.from("surfers").select(SELECT).eq("slug", slug).maybeSingle()

  if (error) {
    console.error("getSurferBySlug:", error.message)
    return null
  }
  if (!data) return null
  return mapSurferRow(data as Record<string, unknown>)
}

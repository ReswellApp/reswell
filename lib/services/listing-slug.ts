import type { SupabaseClient } from "@supabase/supabase-js"
import { slugify } from "@/lib/slugify"

/**
 * Generates a URL-safe slug unique among `listings.slug` (excluding nulls).
 *
 * Fetches the base slug and all numeric-suffix variants in one query, then
 * picks the first free suffix in memory (previously this probed each candidate
 * with a separate count query — up to ~100 round trips on popular titles).
 * A timestamp suffix is the collision-proof fallback if the read fails or the
 * suffix space is exhausted.
 */
export async function generateUniqueListingSlug(
  supabase: SupabaseClient,
  title: string,
): Promise<string> {
  // slugify output is [a-z0-9-] only, so `base` is safe to interpolate into
  // the PostgREST `or` filter below.
  const base = slugify(title.trim() || "listing") || "listing"

  const { data, error } = await supabase
    .from("listings")
    .select("slug")
    .or(`slug.eq.${base},slug.like.${base}-%`)
    .limit(1000)

  if (error) {
    return `${base}-${Date.now()}`
  }

  const taken = new Set<string>()
  for (const row of data ?? []) {
    if (typeof row.slug === "string") taken.add(row.slug)
  }

  if (!taken.has(base)) return base
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base}-${Date.now()}`
}

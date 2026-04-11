import type { SupabaseClient } from "@supabase/supabase-js"
import { slugify } from "@/lib/slugify"

/**
 * Generates a URL-safe slug unique among `listings.slug` (excluding nulls).
 */
export async function generateUniqueListingSlug(
  supabase: SupabaseClient,
  title: string,
): Promise<string> {
  const base = slugify(title.trim() || "listing") || "listing"
  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("slug", base)
  if (!count) return base
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`
    const { count: c } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("slug", candidate)
    if (!c) return candidate
  }
  return `${base}-${Date.now()}`
}

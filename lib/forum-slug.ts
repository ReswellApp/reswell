import type { SupabaseClient } from "@supabase/supabase-js"
import { slugify } from "@/lib/slugify"

/** Resolves a unique `forum_threads.slug` from a title (used on create). */
export async function pickUniqueThreadSlug(
  supabase: SupabaseClient,
  title: string,
): Promise<string> {
  const base = slugify(title.trim()) || "thread"
  let candidate = base
  for (let i = 0; i < 50; i++) {
    const { data } = await supabase.from("forum_threads").select("id").eq("slug", candidate).maybeSingle()
    if (!data) return candidate
    candidate = `${base}-${i + 2}`
  }
  return `${base}-${Date.now()}`
}

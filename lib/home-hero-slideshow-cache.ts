import { createClient } from "@supabase/supabase-js"
import { listHomeHeroImageUrls } from "@/lib/db/home-hero-images"

function anonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }
  return createClient(url, key)
}

/** Homepage hero image URLs from DB (anon client — not scoped to a user session). */
export async function getHomeHeroImageUrls(): Promise<string[]> {
  const supabase = anonSupabase()
  return listHomeHeroImageUrls(supabase)
}

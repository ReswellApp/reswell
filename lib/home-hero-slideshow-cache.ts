import { unstable_cache } from "next/cache"
import { createClient } from "@supabase/supabase-js"
import { listHomeHeroImageUrls } from "@/lib/db/home-hero-images"

/** Next.js Data Cache tag — invalidate when admins change hero slides (see admin home-hero-slides API routes). */
export const HOME_HERO_SLIDESHOW_CACHE_TAG = "home-hero-slideshow" as const

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60

function anonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }
  return createClient(url, key)
}

async function fetchHomeHeroImageUrls(): Promise<string[]> {
  const supabase = anonSupabase()
  return listHomeHeroImageUrls(supabase)
}

const getCachedHomeHeroImageUrlsInner = unstable_cache(fetchHomeHeroImageUrls, ["home-hero-slideshow-urls"], {
  revalidate: SEVEN_DAYS_SECONDS,
  tags: [HOME_HERO_SLIDESHOW_CACHE_TAG],
})

/**
 * Homepage hero DB image URLs — cached ~7 days (Next.js Data Cache), same revalidation window.
 * Uses the anon client so the cache entry is not scoped to a single user session.
 */
export function getCachedHomeHeroImageUrls(): Promise<string[]> {
  return getCachedHomeHeroImageUrlsInner()
}

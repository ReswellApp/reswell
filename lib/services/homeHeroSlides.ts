import type { SupabaseClient } from "@supabase/supabase-js"
import { FALLBACK_HOME_HERO_SLIDE_PATHS } from "@/components/hero-slideshow"
import { normalizeHeroSlideUrl } from "@/lib/home-hero-slide-urls"
import { listHomeHeroCuratedSlideUrls } from "@/lib/db/home-hero-listings"
import { listingHeroSlideSrc, type ListingImageForCard } from "@/lib/listing-image-display"

export async function loadHomeHeroSlideUrls(supabase: SupabaseClient): Promise<string[]> {
  const curatedHeroUrls = await listHomeHeroCuratedSlideUrls(supabase)
  const useCuratedHeroOnly = curatedHeroUrls.length > 0

  const heroListingsRes = useCuratedHeroOnly
    ? { data: null as { listing_images: unknown }[] | null }
    : await supabase
        .from("listings")
        .select("listing_images (url, is_primary)")
        .eq("status", "active")
        .eq("section", "surfboards")
        .eq("hidden_from_site", false)
        .eq("hidden_from_homepage", false)
        .order("created_at", { ascending: false })
        .limit(24)

  const heroSlideUrls: string[] = []
  if (useCuratedHeroOnly) {
    const heroSeen = new Set<string>()
    for (const src of curatedHeroUrls) {
      const key = normalizeHeroSlideUrl(src)
      if (!key || heroSeen.has(key)) continue
      heroSeen.add(key)
      heroSlideUrls.push(src)
    }
  } else {
    const heroSeen = new Set<string>()
    for (const row of heroListingsRes.data ?? []) {
      const src = listingHeroSlideSrc(row.listing_images as ListingImageForCard[] | null)
      if (!src) continue
      const key = normalizeHeroSlideUrl(src)
      if (!key || heroSeen.has(key)) continue
      heroSeen.add(key)
      heroSlideUrls.push(src)
      if (heroSlideUrls.length >= 5) break
    }
  }

  if (heroSlideUrls.length === 0) {
    heroSlideUrls.push(...FALLBACK_HOME_HERO_SLIDE_PATHS)
  }

  return heroSlideUrls
}

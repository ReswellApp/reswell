import type { SupabaseClient } from "@supabase/supabase-js"
import {
  FALLBACK_HOME_HERO_SLIDE_PATHS,
  normalizeHeroSlideUrl,
} from "@/lib/home-hero-slide-urls"
import { listHomeHeroCuratedSlideUrls } from "@/lib/db/home-hero-listings"
import { listingHeroSlideSrc, type ListingImageForCard } from "@/lib/listing-image-display"

export type LoadHomeHeroSlideUrlsOptions = {
  /** When set, only listing images from this marketplace section are included. */
  section?: string
  /** When true, only URLs from listing photos are returned — no static hero-slide fallbacks. */
  listingImagesOnly?: boolean
}

function addUniqueHeroSlideUrl(
  urls: string[],
  seen: Set<string>,
  src: string | null | undefined,
): void {
  if (!src) return
  const key = normalizeHeroSlideUrl(src)
  if (!key || seen.has(key)) return
  seen.add(key)
  urls.push(src.trim())
}

export async function loadHomeHeroSlideUrls(
  supabase: SupabaseClient,
  options?: LoadHomeHeroSlideUrlsOptions,
): Promise<string[]> {
  const sectionFilter = options?.section?.trim()
  const listingImagesOnly = options?.listingImagesOnly === true
  const maxUrls = listingImagesOnly ? 24 : 5

  const curatedHeroUrls = sectionFilter
    ? await listHomeHeroCuratedSlideUrls(supabase, { section: sectionFilter })
    : await listHomeHeroCuratedSlideUrls(supabase)

  const skipListingQuery = curatedHeroUrls.length > 0 && !listingImagesOnly

  const heroListingsRes = skipListingQuery
    ? { data: null as { listing_images: unknown }[] | null }
    : await supabase
        .from("listings")
        .select("listing_images (url, is_primary)")
        .eq("status", "active")
        .eq("section", sectionFilter ?? "surfboards")
        .eq("hidden_from_site", false)
        .eq("hidden_from_homepage", false)
        .order("created_at", { ascending: false })
        .limit(listingImagesOnly ? 48 : 24)

  const heroSlideUrls: string[] = []
  const heroSeen = new Set<string>()

  if (skipListingQuery) {
    for (const src of curatedHeroUrls) {
      addUniqueHeroSlideUrl(heroSlideUrls, heroSeen, src)
    }
  } else {
    for (const src of curatedHeroUrls) {
      addUniqueHeroSlideUrl(heroSlideUrls, heroSeen, src)
      if (heroSlideUrls.length >= maxUrls) break
    }
    for (const row of heroListingsRes.data ?? []) {
      addUniqueHeroSlideUrl(
        heroSlideUrls,
        heroSeen,
        listingHeroSlideSrc(row.listing_images as ListingImageForCard[] | null),
      )
      if (heroSlideUrls.length >= maxUrls) break
    }
  }

  if (!listingImagesOnly && heroSlideUrls.length === 0) {
    heroSlideUrls.push(...FALLBACK_HOME_HERO_SLIDE_PATHS)
  }

  return heroSlideUrls
}

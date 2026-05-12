"use client"

import { searchBrandsCatalogSuggest, type BrandCatalogSuggestRow } from "@/app/actions/marketplace"
import { slugify } from "@/lib/slugify"

type AppRouterLike = {
  push: (href: string) => void
}

/**
 * Map a user-picked label (often listing `brand` text like "Channel Islands") to a
 * `public.brands` row from `searchBrandsCatalogSuggest` results. Never guess `rows[0]`:
 * ES fuzzy match order can put unrelated brands first.
 */
function pickCatalogBrandForNavPick(rows: BrandCatalogSuggestRow[], pickedLabel: string): BrandCatalogSuggestRow | null {
  const q = pickedLabel.trim()
  if (!q || rows.length === 0) return null
  const lower = q.toLowerCase()
  const slugHint = slugify(q).toLowerCase()

  const exact = rows.find((r) => r.name.toLowerCase() === lower)
  if (exact) return exact

  const extendedName = rows.find((r) => {
    const n = r.name.toLowerCase()
    return n.startsWith(lower + " ") || n.startsWith(lower + "·")
  })
  if (extendedName) return extendedName

  const nameContains = rows.find((r) => r.name.toLowerCase().includes(lower))
  if (nameContains) return nameContains

  if (slugHint) {
    const bySlug = rows.find((r) => {
      const s = r.slug.toLowerCase()
      return s === slugHint || s.startsWith(`${slugHint}-`)
    })
    if (bySlug) return bySlug
  }

  return null
}

/**
 * Navigate to marketplace search scoped to a directory brand (listings with matching
 * `brand_id` or legacy `brand` text). Falls back to keyword `?q=` if no catalog match.
 */
export async function navigateToMarketplaceBrandResults(
  router: AppRouterLike,
  brandDisplayName: string,
  options?: { categorySlug?: string | null; navSubmitted?: boolean },
): Promise<void> {
  const name = brandDisplayName.trim()
  if (!name) return

  try {
    const { rows } = await searchBrandsCatalogSuggest(name)
    const exact = pickCatalogBrandForNavPick(rows, name)
    if (exact) {
      const params = new URLSearchParams()
      params.set("brandSlug", exact.slug)
      const cat = options?.categorySlug?.trim()
      if (cat) params.set("category", cat)
      if (options?.navSubmitted) params.set("nq", "1")
      router.push(`/search?${params.toString()}`)
      return
    }
  } catch {
    /* keyword fallback below */
  }

  const params = new URLSearchParams()
  params.set("q", name)
  const cat = options?.categorySlug?.trim()
  if (cat) params.set("category", cat)
  if (options?.navSubmitted) params.set("nq", "1")
  router.push(`/search?${params.toString()}`)
}

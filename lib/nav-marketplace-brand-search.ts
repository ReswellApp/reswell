"use client"

import { searchBrandsCatalogSuggest } from "@/app/actions/marketplace"

type AppRouterLike = {
  push: (href: string) => void
}

/**
 * Navigate to marketplace search scoped to a directory brand (listings with matching
 * `brand_id` or legacy `brand` text). Falls back to keyword `?q=` if no catalog match.
 */
export async function navigateToMarketplaceBrandResults(
  router: AppRouterLike,
  brandDisplayName: string,
  options?: { categorySlug?: string | null },
): Promise<void> {
  const name = brandDisplayName.trim()
  if (!name) return

  try {
    const { rows } = await searchBrandsCatalogSuggest(name)
    const lower = name.toLowerCase()
    const exact = rows.find((r) => r.name.toLowerCase() === lower) ?? rows[0]
    if (exact) {
      const params = new URLSearchParams()
      params.set("brandSlug", exact.slug)
      const cat = options?.categorySlug?.trim()
      if (cat) params.set("category", cat)
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
  router.push(`/search?${params.toString()}`)
}

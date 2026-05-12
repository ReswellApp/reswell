"use client"

import { resolveBrandProfilePathFromNavLabel } from "@/app/actions/marketplace"

type AppRouterLike = {
  push: (href: string) => void
}

/**
 * Header nav brand chip / strip: go to the directory brand profile (`/brands/{slug}`).
 * Falls back to `/search?q=` when the label does not resolve to a catalog row.
 */
export async function navigateToBrandProfileFromNavPick(
  router: AppRouterLike,
  brandDisplayName: string,
  options?: { categorySlug?: string | null; navSubmitted?: boolean },
): Promise<void> {
  const name = brandDisplayName.trim()
  if (!name) return

  try {
    const path = await resolveBrandProfilePathFromNavLabel(name)
    if (path) {
      router.push(path)
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

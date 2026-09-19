"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { cityLandingHrefWithBrowseParams } from "@/lib/city-landing-path"
import { logBrowseFacetClick } from "@/lib/log-browse-button-click"

type CityLandingMatch = {
  slug: string
  href: string
  label: string
}

async function fetchCityLandingMatch(
  query: { label: string; city?: string; state?: string },
  signal?: AbortSignal,
): Promise<CityLandingMatch | null> {
  const params = new URLSearchParams({ label: query.label })
  if (query.city) params.set("city", query.city)
  if (query.state) params.set("state", query.state)
  try {
    const res = await fetch(`/api/cities/resolve?${params.toString()}`, { signal })
    if (!res.ok) return null
    const body = (await res.json()) as { data?: CityLandingMatch | null }
    return body.data ?? null
  } catch {
    return null
  }
}

export function useBoardsLocationCityRedirect(searchParams: URLSearchParams) {
  const router = useRouter()

  const goToCityLanding = useCallback(
    (match: CityLandingMatch) => {
      logBrowseFacetClick({
        category: "boards",
        facetKey: "location",
        facetValue: match.label,
        detail: "set",
      })
      router.push(cityLandingHrefWithBrowseParams(match.slug, searchParams))
    },
    [router, searchParams],
  )

  const resolveCityLanding = useCallback(
    (query: { label: string; city?: string; state?: string }, signal?: AbortSignal) =>
      fetchCityLandingMatch(query, signal),
    [],
  )

  return { goToCityLanding, resolveCityLanding }
}

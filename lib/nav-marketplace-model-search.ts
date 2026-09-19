"use client"

import { resolveMarketplaceModelPageHref } from "@/app/actions/marketplace"
import { headerNavSearchSubmitHref } from "@/lib/header-nav-marketplace-search"
import { MARKETPLACE_SEARCH_OPENS_MODEL_PAGES } from "@/lib/models/routes"

/**
 * Header nav submit: section / style keywords stay on browse hubs;
 * unique catalog models stay on `/search` until model-page redirects launch;
 * everything else is `/search`.
 */
export async function hrefForNavMarketplaceSearch(
  term: string,
  pathname?: string | null,
  searchParams?: Pick<URLSearchParams, "get">,
): Promise<string> {
  const fallback = headerNavSearchSubmitHref(term, pathname, searchParams)
  if (!fallback.startsWith("/search?")) return fallback
  if (!MARKETPLACE_SEARCH_OPENS_MODEL_PAGES) return fallback

  try {
    const modelHref = await resolveMarketplaceModelPageHref(term)
    if (modelHref) return modelHref
  } catch {
    /* keyword fallback below */
  }
  return fallback
}

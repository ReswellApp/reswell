"use client"

import { resolveMarketplaceModelPageHref } from "@/app/actions/marketplace"
import { headerNavSearchSubmitHref } from "@/lib/header-nav-marketplace-search"

/**
 * Header nav submit: section / style keywords stay on browse hubs;
 * a unique catalog model goes to `/[brand]/[model]`; everything else is `/search`.
 */
export async function hrefForNavMarketplaceSearch(
  term: string,
  pathname?: string | null,
  searchParams?: Pick<URLSearchParams, "get">,
): Promise<string> {
  const fallback = headerNavSearchSubmitHref(term, pathname, searchParams)
  if (!fallback.startsWith("/search?")) return fallback

  try {
    const modelHref = await resolveMarketplaceModelPageHref(term)
    if (modelHref) return modelHref
  } catch {
    /* keyword fallback below */
  }
  return fallback
}

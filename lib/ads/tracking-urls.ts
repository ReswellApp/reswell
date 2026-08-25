/**
 * UTM query params stamped onto catalog / Merchant landing URLs so ad clicks
 * arrive as paid traffic (and first-party attribution can classify them).
 */

export const META_CATALOG_UTM = {
  utm_source: "facebook",
  utm_medium: "paid",
  utm_campaign: "meta_catalog",
} as const

export const GOOGLE_SHOPPING_UTM = {
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "google_shopping",
} as const

export const OPENAI_CATALOG_UTM = {
  utm_source: "chatgpt",
  utm_medium: "paid",
  utm_campaign: "openai_catalog",
} as const

/** Paste into Meta Ads Manager → Ad → Website URL parameters (non-catalog / traffic ads). */
export const META_ADS_MANAGER_URL_PARAMETERS =
  "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}"

export function appendTrackingParams(
  url: string,
  params: Record<string, string | null | undefined>,
): string {
  const trimmed = url.trim()
  if (!trimmed) return url
  try {
    const parsed = new URL(trimmed)
    for (const [key, value] of Object.entries(params)) {
      const v = value?.trim()
      if (!v) continue
      if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, v)
    }
    return parsed.toString()
  } catch {
    return url
  }
}

export function withMetaCatalogTracking(url: string, listingId: string): string {
  return appendTrackingParams(url, {
    ...META_CATALOG_UTM,
    utm_content: listingId,
  })
}

export function withGoogleShoppingTracking(url: string, listingId: string): string {
  return appendTrackingParams(url, {
    ...GOOGLE_SHOPPING_UTM,
    utm_content: listingId,
  })
}

export function withOpenAiCatalogTracking(url: string, listingId: string): string {
  return appendTrackingParams(url, {
    ...OPENAI_CATALOG_UTM,
    utm_content: listingId,
  })
}

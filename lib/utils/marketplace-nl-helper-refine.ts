/**
 * Client-safe NL helper refine types + URL merge.
 * Kept free of server-only imports (`next/headers`, Supabase server clients).
 */

export type MarketplaceNlHelperRefine = {
  brandId?: string
  brandModelId?: string
  minPrice?: string
  maxPrice?: string
  condition?: string
  style?: string
  fin?: string
  finSystem?: string
  construction?: string
  shipping?: string
  location?: string
  dimLength?: string
  /** Comma-separated length facet bucket slugs. */
  length?: string
  /** Params to remove (e.g. bad `$6` price left from a prior mis-parse of "under 6 feet"). */
  clearParams?: string[]
}

/**
 * Merge helper refine params into the current URL search params.
 * Only sets keys that are missing/empty so explicit user filters win.
 * Returns null when nothing would change.
 */
export function mergeNlHelperRefineIntoSearchParams(
  current: URLSearchParams,
  refine: MarketplaceNlHelperRefine,
): URLSearchParams | null {
  const next = new URLSearchParams(current.toString())
  let changed = false

  for (const key of refine.clearParams ?? []) {
    if (!key.trim()) continue
    if (next.has(key)) {
      next.delete(key)
      changed = true
    }
  }

  const setIfAbsent = (key: string, value: string | undefined) => {
    if (!value?.trim()) return
    const existing = next.get(key)?.trim()
    if (existing) return
    next.set(key, value.trim())
    changed = true
  }

  setIfAbsent("brandModelId", refine.brandModelId)
  if (!next.get("brandModelId")?.trim()) setIfAbsent("brandId", refine.brandId)
  setIfAbsent("minPrice", refine.minPrice)
  setIfAbsent("maxPrice", refine.maxPrice)
  setIfAbsent("condition", refine.condition)
  setIfAbsent("style", refine.style)
  setIfAbsent("fin", refine.fin)
  setIfAbsent("finSystem", refine.finSystem)
  setIfAbsent("construction", refine.construction)
  setIfAbsent("shipping", refine.shipping)
  setIfAbsent("location", refine.location)
  setIfAbsent("dimLength", refine.dimLength)
  setIfAbsent("length", refine.length)

  return changed ? next : null
}

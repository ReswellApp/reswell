import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Lightweight affinity profile used to rank winback listings for an inactive user.
 * Built from explicit intent (saved /boards searches) and behavior (favorites),
 * plus the user's location. Empty when we have no signal — callers fall back to
 * "newest" ordering.
 */
export type InactiveUserPreferences = {
  brands: Set<string>
  sections: Set<string>
  priceMin: number | null
  priceMax: number | null
  state: string | null
  hasSignal: boolean
}

const EMPTY_PREFERENCES: InactiveUserPreferences = {
  brands: new Set(),
  sections: new Set(),
  priceMin: null,
  priceMax: null,
  state: null,
  hasSignal: false,
}

const FAVORITES_SAMPLE_LIMIT = 24
const SAVED_SEARCH_SAMPLE_LIMIT = 12

function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") return null
  const v = value.trim().toLowerCase()
  return v.length ? v : null
}

function coercePrice(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null
}

/** Pull brand / section / price hints out of a loosely-shaped saved-search criteria blob. */
function applyCriteria(
  criteria: Record<string, unknown> | null,
  acc: { brands: Set<string>; sections: Set<string>; mins: number[]; maxes: number[] },
): void {
  if (!criteria || typeof criteria !== "object") return

  const brand = normalizeToken(criteria.brand)
  if (brand) acc.brands.add(brand)

  const section = normalizeToken(criteria.section) ?? normalizeToken(criteria.type)
  if (section) acc.sections.add(section)

  const price = criteria.price
  if (price && typeof price === "object") {
    const min = coercePrice((price as Record<string, unknown>).min)
    const max = coercePrice((price as Record<string, unknown>).max)
    if (min != null) acc.mins.push(min)
    if (max != null) acc.maxes.push(max)
  }
}

/**
 * Best-effort preference fetch for one user. Never throws — on any error it
 * returns an empty (no-signal) profile so personalization degrades to newest-first.
 */
export async function fetchInactiveUserPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<InactiveUserPreferences> {
  const id = userId.trim()
  if (!id) return EMPTY_PREFERENCES

  const acc = {
    brands: new Set<string>(),
    sections: new Set<string>(),
    mins: [] as number[],
    maxes: [] as number[],
  }
  let state: string | null = null

  try {
    const [savedSearches, favorites, profile] = await Promise.all([
      supabase
        .from("saved_searches")
        .select("criteria")
        .eq("user_id", id)
        .limit(SAVED_SEARCH_SAMPLE_LIMIT),
      supabase
        .from("favorites")
        .select("listing:listings ( brand, section, price )")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(FAVORITES_SAMPLE_LIMIT),
      supabase.from("profiles").select("state").eq("id", id).maybeSingle(),
    ])

    for (const row of savedSearches.data ?? []) {
      applyCriteria((row as { criteria?: Record<string, unknown> | null }).criteria ?? null, acc)
    }

    for (const fav of favorites.data ?? []) {
      const raw = (fav as { listing?: unknown }).listing
      const listing = Array.isArray(raw) ? raw[0] : raw
      if (!listing || typeof listing !== "object") continue
      const l = listing as Record<string, unknown>
      const brand = normalizeToken(l.brand)
      if (brand) acc.brands.add(brand)
      const section = normalizeToken(l.section)
      if (section) acc.sections.add(section)
      const price = coercePrice(l.price)
      if (price != null) {
        acc.mins.push(price)
        acc.maxes.push(price)
      }
    }

    state = normalizeToken((profile.data as { state?: unknown } | null)?.state)
  } catch (e) {
    console.warn("[inactive-prefs] preference fetch failed:", e)
    return EMPTY_PREFERENCES
  }

  // Widen the favorite-derived price band by 40% so we don't over-filter.
  const priceMin = acc.mins.length ? Math.min(...acc.mins) * 0.6 : null
  const priceMax = acc.maxes.length ? Math.max(...acc.maxes) * 1.4 : null

  const hasSignal =
    acc.brands.size > 0 ||
    acc.sections.size > 0 ||
    priceMin != null ||
    priceMax != null ||
    Boolean(state)

  return {
    brands: acc.brands,
    sections: acc.sections,
    priceMin,
    priceMax,
    state,
    hasSignal,
  }
}

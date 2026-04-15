/**
 * Canonical surfboard category labels for UI. Some deployments still have legacy
 * `categories.name` values (e.g. "Fish", "Mid-length"); we normalize display using
 * fixed UUIDs from `boardCategoryMap` and known slug aliases.
 */
import { boardCategoryMap } from "@/lib/utils/board-type-from-category-id"

const CANONICAL_NAME_BY_CATEGORY_ID: Record<string, string> = {
  [boardCategoryMap.shortboard]: "Shortboard",
  [boardCategoryMap.longboard]: "Longboard",
  [boardCategoryMap.hybrid]: "Hybrid",
  [boardCategoryMap["step-up-gun"]]: "Step-Up / Gun",
  [boardCategoryMap.groveler]: "Groveler",
  [boardCategoryMap.other]: "Other",
}

/** Slug-only fallbacks when `id` is unknown or duplicated across environments. */
const CANONICAL_NAME_BY_SLUG: Record<string, string> = {
  shortboard: "Shortboard",
  longboard: "Longboard",
  hybrid: "Hybrid",
  "step-up-gun": "Step-Up / Gun",
  "step-up": "Step-Up / Gun",
  gun: "Step-Up / Gun",
  groveler: "Groveler",
  fish: "Groveler",
  funboard: "Hybrid",
  "mid-length": "Hybrid",
  other: "Other",
}

export function canonicalSurfboardCategoryName(row: {
  id: string
  name: string
  slug?: string | null
}): string {
  const byId = CANONICAL_NAME_BY_CATEGORY_ID[row.id]
  if (byId) return byId

  const slug = row.slug?.trim().toLowerCase()
  if (slug) {
    const bySlug = CANONICAL_NAME_BY_SLUG[slug]
    if (bySlug) return bySlug
  }

  return row.name
}

/** Normalize `categories.name` on admin listing rows for surfboards (legacy DB labels). */
export function applyCanonicalSurfboardCategoryToListingRow<T extends Record<string, unknown>>(row: T): T {
  if (row.section !== "surfboards") return row
  const categoryId = row.category_id
  if (typeof categoryId !== "string") return row

  const raw = row.categories
  const cat = Array.isArray(raw) ? raw[0] : raw
  if (!cat || typeof cat !== "object") return row

  const c = cat as { name?: string | null; slug?: string | null }
  const displayName = canonicalSurfboardCategoryName({
    id: categoryId,
    name: typeof c.name === "string" ? c.name : "",
    slug: c.slug,
  })

  return {
    ...row,
    categories: { name: displayName, slug: c.slug ?? null },
  }
}

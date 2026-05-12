import { slugify } from "@/lib/slugify"

export type BrandNavPickRow = { name: string; slug: string }

/**
 * Map a user-picked label (often listing `brand` text like "Channel Islands") to a
 * `public.brands` row from catalog-suggest results. Never use `rows[0]` alone:
 * Elasticsearch relevance ordering can surface unrelated brands first, or omit
 * the true match from a capped page of results.
 */
export function pickCatalogBrandForNavPick(
  rows: BrandNavPickRow[],
  pickedLabel: string,
): BrandNavPickRow | null {
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

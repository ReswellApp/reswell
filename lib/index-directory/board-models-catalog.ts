import { getAllBrandSlugs, getBrandProfileBySlug } from "@/lib/index-directory/registry"

export type IndexBoardModelOption = {
  brandSlug: string
  brandName: string
  modelSlug: string
  modelName: string
  /** Search + display: model first, then brand */
  label: string
}

let cache: IndexBoardModelOption[] | null = null

export function getAllIndexBoardModelOptions(): IndexBoardModelOption[] {
  if (cache) return cache
  const out: IndexBoardModelOption[] = []
  for (const slug of getAllBrandSlugs()) {
    const b = getBrandProfileBySlug(slug)
    if (!b) continue
    for (const m of b.models) {
      out.push({
        brandSlug: b.slug,
        brandName: b.name,
        modelSlug: m.slug,
        modelName: m.name,
        label: `${m.name} — ${b.name}`,
      })
    }
  }
  out.sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }))
  cache = out
  return out
}

/** For tests / hot reload in dev */
export function clearIndexBoardModelOptionsCache() {
  cache = null
}

export function searchIndexBoardModels(query: string, limit = 40): IndexBoardModelOption[] {
  const q = query.trim().toLowerCase()
  const all = getAllIndexBoardModelOptions()
  if (!q) return all.slice(0, limit)
  return all
    .filter((o) => {
      const hay = `${o.label} ${o.brandName} ${o.modelName} ${o.brandSlug} ${o.modelSlug}`.toLowerCase()
      return hay.includes(q)
    })
    .slice(0, limit)
}

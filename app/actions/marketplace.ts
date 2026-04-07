"use server"

import { createClient } from "@/lib/supabase/server"
import { listBrands } from "@/lib/brands/server"

export async function getDistinctBrandsFromListings(section: string): Promise<string[]> {
  const sections = section === "new" ? ["new"] : ["surfboards"]

  const supabase = await createClient()
  const { data } = await supabase
    .from("listings")
    .select("brand")
    .eq("status", "active")
    .in("section", sections)
    .not("brand", "is", null)

  const set = new Set<string>()
  return (data || [])
    .map((r) => r.brand?.trim())
    .filter((b): b is string => !!b && b.length > 0)
    .filter((b) => {
      const key = b.toLowerCase()
      if (set.has(key)) return false
      set.add(key)
      return true
    })
    .sort((a, b) => a.localeCompare(b))
}

export type InventoryProductRow = {
  id: string
  name: string
  price: number
  image_url: string | null
  stock_quantity: number
}

export async function getInventoryProductById(
  id: string,
): Promise<{ product: InventoryProductRow } | { error: string }> {
  const supabase = await createClient()
  const { data: product, error } = await supabase
    .from("inventory")
    .select("id, name, price, image_url, stock_quantity")
    .eq("id", id)
    .eq("is_active", true)
    .single()

  if (error || !product) {
    return { error: "Product not found" }
  }
  return { product: product as InventoryProductRow }
}

export async function getBoardModelsCatalogItems() {
  const supabase = await createClient()
  const brands = await listBrands(supabase)
  const items = brands.map((b) => ({
    brandSlug: b.slug,
    modelSlug: "",
    brandName: b.name,
    modelName: "",
    label: b.name,
  }))
  return { items }
}

/** Returned to the client after dedupe / slice */
const MAX_TITLES = 20
const MAX_CATEGORIES = 12
const MAX_BRANDS = 16
const MAX_LISTINGS = 12
const TITLE_SUGGEST_FETCH = 80

export type SuggestListing = {
  id: string
  slug: string | null
  title: string
  price: number
  section: string
  imageUrl: string | null
  brand: string | null
  city: string | null
  state: string | null
  condition: string | null
}

export type SearchSuggestResult = {
  titles: string[]
  categories: string[]
  brands: string[]
  listings: SuggestListing[]
}

function escapeIlikeToken(q: string) {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export async function searchSuggest(qRaw: string, section: string): Promise<SearchSuggestResult> {
  const q = (qRaw || "").trim().replace(/%/g, "")
  if (!q || q.length < 2) {
    return {
      titles: [],
      categories: [],
      brands: [],
      listings: [],
    }
  }

  const supabase = await createClient()
  const safe = escapeIlikeToken(q)
  const pattern = `"%${safe}%"`
  const sections = section === "new" ? ["new"] : ["surfboards"]

  const textOr = `title.ilike.${pattern},description.ilike.${pattern},brand.ilike.${pattern}`

  const [listingsRes, titlesRes, categoriesRes, brandsRes] = await Promise.all([
    supabase
      .from("listings")
      .select(
        `
        id,
        slug,
        title,
        price,
        section,
        city,
        state,
        brand,
        condition,
        listing_images (url, is_primary)
      `,
      )
      .eq("status", "active")
      .in("section", sections)
      .or(textOr)
      .order("created_at", { ascending: false })
      .limit(MAX_LISTINGS),
    supabase
      .from("listings")
      .select("title")
      .eq("status", "active")
      .in("section", sections)
      .or(textOr)
      .order("created_at", { ascending: false })
      .limit(TITLE_SUGGEST_FETCH),
    supabase
      .from("categories")
      .select("name, slug")
      .eq("board", true)
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
      .order("name", { ascending: true })
      .limit(MAX_CATEGORIES * 3),
    supabase
      .from("listings")
      .select("brand")
      .eq("status", "active")
      .in("section", sections)
      .not("brand", "is", null)
      .ilike("brand", `%${safe}%`)
      .order("created_at", { ascending: false })
      .limit(MAX_BRANDS * 4),
  ])

  const listings: SuggestListing[] = (listingsRes.data || []).map((row: Record<string, unknown>) => {
    const imgs = row.listing_images as { url?: string; is_primary?: boolean }[] | null
    const primary = imgs?.find((i) => i.is_primary) || imgs?.[0]
    return {
      id: row.id as string,
      slug: (row.slug as string | null) ?? null,
      title: (row.title as string) ?? "",
      price: typeof row.price === "number" ? row.price : parseFloat(String(row.price)) || 0,
      section: row.section as string,
      imageUrl: primary?.url ?? null,
      brand: (row.brand as string | null) ?? null,
      city: (row.city as string | null) ?? null,
      state: (row.state as string | null) ?? null,
      condition: (row.condition as string | null) ?? null,
    }
  })

  const titleSet = new Set<string>()
  const titles = (titlesRes.data || [])
    .map((r) => r.title?.trim())
    .filter((t): t is string => !!t && t.length > 0)
    .filter((t) => {
      const k = t.toLowerCase()
      if (titleSet.has(k)) return false
      titleSet.add(k)
      return true
    })
    .slice(0, MAX_TITLES)

  const categories = (categoriesRes.data || [])
    .map((c) => c.name || c.slug)
    .filter(Boolean)
    .slice(0, MAX_CATEGORIES) as string[]

  const brandSet = new Set<string>()
  const brands = (brandsRes.data || [])
    .map((r) => r.brand?.trim())
    .filter((b): b is string => !!b && b.length > 0)
    .filter((b) => {
      const k = b.toLowerCase()
      if (brandSet.has(k)) return false
      brandSet.add(k)
      return true
    })
    .slice(0, MAX_BRANDS)

  return { titles, categories, brands, listings }
}

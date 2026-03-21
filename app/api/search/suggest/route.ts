import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** Returned to the client after dedupe / slice */
const MAX_TITLES = 20
const MAX_CATEGORIES = 12
const MAX_BRANDS = 16
const MAX_LISTINGS = 12
/** Rows to scan before deduping distinct titles (same text match as listings). */
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

function escapeIlikeToken(q: string) {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") || "").trim().replace(/%/g, "")
  const section = searchParams.get("section") || ""

  if (!q || q.length < 2) {
    return NextResponse.json({
      titles: [],
      categories: [],
      brands: [],
      listings: [] as SuggestListing[],
    })
  }

  const supabase = await createClient()
  const safe = escapeIlikeToken(q)
  const pattern = `"%${safe}%"`
  const sections =
    section === "used" ? ["used"] : section === "surfboards" ? ["surfboards"] : ["used", "surfboards"]

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
      .in("section", sections)
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

  const listings: SuggestListing[] = (listingsRes.data || []).map((row: any) => {
    const imgs = row.listing_images as { url?: string; is_primary?: boolean }[] | null
    const primary = imgs?.find((i) => i.is_primary) || imgs?.[0]
    return {
      id: row.id,
      slug: row.slug ?? null,
      title: row.title ?? "",
      price: typeof row.price === "number" ? row.price : parseFloat(row.price) || 0,
      section: row.section,
      imageUrl: primary?.url ?? null,
      brand: row.brand ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      condition: row.condition ?? null,
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

  return NextResponse.json({ titles, categories, brands, listings })
}

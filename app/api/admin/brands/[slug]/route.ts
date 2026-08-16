import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { revalidateHomeTrendingBrandsCatalog } from "@/lib/cache/revalidate-home-public-catalog"
import { revalidateSellCatalogSearch } from "@/lib/cache/revalidate-sell-catalog-search"
import { syncBrandToIndex } from "@/lib/elasticsearch/brands-index"
import { syncFinCatalogBrandToIndex } from "@/lib/elasticsearch/fin-catalog-index"
import { syncSellCatalogBrandToIndex } from "@/lib/elasticsearch/sell-catalog-index"
import { requireAdmin } from "@/lib/brands/admin-server"
import { isValidBrandSlug } from "@/lib/brands/slug"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { parseBrandProductCategorySlugsFromBody } from "@/lib/brand-product-categories"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { syncBrandProductCategories } from "@/lib/db/brand-product-categories"

const MAX_PARAGRAPH = 20000

type PatchBody = {
  slug?: string
  name?: string
  short_description?: string | null
  website_url?: string | null
  logo_url?: string | null
  founder_name?: string | null
  lead_shaper_name?: string | null
  location_label?: string | null
  model_count?: number
  about_paragraphs?: string[]
  about_text?: string
  product_categories?: string[]
}

export async function PATCH(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { slug: paramSlug } = await ctx.params
  const currentSlug = paramSlug.trim()
  if (!currentSlug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { supabase } = gate.ctx
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.slug !== undefined) {
    const s = typeof body.slug === "string" ? body.slug.trim() : ""
    if (!s || !isValidBrandSlug(s)) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 })
    }
    updates.slug = s
  }
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Name required" }, { status: 400 })
    }
    updates.name = body.name.trim()
  }
  if (body.short_description !== undefined) {
    updates.short_description =
      typeof body.short_description === "string" ? body.short_description.trim() || null : null
  }
  if (body.website_url !== undefined) {
    updates.website_url = typeof body.website_url === "string" ? body.website_url.trim() || null : null
  }
  if (body.logo_url !== undefined) {
    updates.logo_url = typeof body.logo_url === "string" ? body.logo_url.trim() || null : null
  }
  if (body.founder_name !== undefined) {
    updates.founder_name = typeof body.founder_name === "string" ? body.founder_name.trim() || null : null
  }
  if (body.lead_shaper_name !== undefined) {
    updates.lead_shaper_name = typeof body.lead_shaper_name === "string" ? body.lead_shaper_name.trim() || null : null
  }
  if (body.location_label !== undefined) {
    updates.location_label = typeof body.location_label === "string" ? body.location_label.trim() || null : null
  }
  if (body.model_count !== undefined) {
    const n = Number(body.model_count)
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
      return NextResponse.json({ error: "Invalid model count" }, { status: 400 })
    }
    updates.model_count = Math.floor(n)
  }
  if (body.about_paragraphs !== undefined) {
    if (!Array.isArray(body.about_paragraphs)) {
      return NextResponse.json({ error: "about_paragraphs must be an array" }, { status: 400 })
    }
    const paras = body.about_paragraphs
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean)
    if (paras.join("").length > MAX_PARAGRAPH) {
      return NextResponse.json({ error: "About text is too long" }, { status: 400 })
    }
    updates.about_paragraphs = paras
  } else if (typeof body.about_text === "string") {
    const paras = body.about_text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (paras.join("").length > MAX_PARAGRAPH) {
      return NextResponse.json({ error: "About text is too long" }, { status: 400 })
    }
    updates.about_paragraphs = paras
  }

  let productCategoriesUpdate: BrandProductCategorySlug[] | undefined
  if (body.product_categories !== undefined) {
    const parsedCategories = parseBrandProductCategorySlugsFromBody(body.product_categories)
    if ("error" in parsedCategories) {
      return NextResponse.json({ error: parsedCategories.error }, { status: 400 })
    }
    productCategoriesUpdate = parsedCategories
  }

  const { data, error } = await supabase
    .from("brands")
    .update(updates)
    .eq("slug", currentSlug)
    .select("id, slug")
    .maybeSingle()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 })
    }
    console.error("admin brands PATCH:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 })
  }

  if (productCategoriesUpdate !== undefined) {
    const categorySync = await syncBrandProductCategories(
      supabase,
      data.id,
      productCategoriesUpdate,
    )
    if (!categorySync.ok) {
      return NextResponse.json({ error: categorySync.error }, { status: 500 })
    }
  }

  revalidatePath(BRANDS_BASE)
  revalidatePath(`${BRANDS_BASE}/${currentSlug}`)
  revalidatePath(`${BRANDS_BASE}/${data.slug}`)
  if (
    body.logo_url !== undefined ||
    body.name !== undefined ||
    body.slug !== undefined
  ) {
    revalidateHomeTrendingBrandsCatalog()
  }
  void syncBrandToIndex(supabase, data.id)
  void syncFinCatalogBrandToIndex(supabase, data.id)
  void syncSellCatalogBrandToIndex(supabase, data.id)
  revalidateSellCatalogSearch()
  return NextResponse.json({ slug: data.slug })
}

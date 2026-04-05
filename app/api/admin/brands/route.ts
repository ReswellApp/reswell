import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { isValidBrandSlug } from "@/lib/brands/slug"
import { BRANDS_BASE } from "@/lib/brands/routes"

const MAX_PARAGRAPH = 20000

function parseBody(body: unknown): {
  slug: string
  name: string
  short_description: string | null
  website_url: string | null
  logo_url: string | null
  founder_name: string | null
  lead_shaper_name: string | null
  location_label: string | null
  model_count: number
  about_paragraphs: string[]
} | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid JSON" }
  const o = body as Record<string, unknown>
  const slug = typeof o.slug === "string" ? o.slug.trim() : ""
  const name = typeof o.name === "string" ? o.name.trim() : ""
  if (!slug || !isValidBrandSlug(slug)) return { error: "Invalid slug (use lowercase letters, numbers, hyphens)" }
  if (!name) return { error: "Name is required" }
  const modelCount = Number(o.model_count)
  if (!Number.isFinite(modelCount) || modelCount < 0 || modelCount > 1_000_000) {
    return { error: "Invalid model count" }
  }
  let about_paragraphs: string[] = []
  if (Array.isArray(o.about_paragraphs)) {
    about_paragraphs = o.about_paragraphs
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean)
  } else if (typeof o.about_text === "string") {
    about_paragraphs = o.about_text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
  }
  const totalLen = about_paragraphs.join("").length
  if (totalLen > MAX_PARAGRAPH) return { error: "About text is too long" }

  return {
    slug,
    name,
    short_description: typeof o.short_description === "string" ? o.short_description.trim() || null : null,
    website_url: typeof o.website_url === "string" ? o.website_url.trim() || null : null,
    logo_url: typeof o.logo_url === "string" ? o.logo_url.trim() || null : null,
    founder_name: typeof o.founder_name === "string" ? o.founder_name.trim() || null : null,
    lead_shaper_name: typeof o.lead_shaper_name === "string" ? o.lead_shaper_name.trim() || null : null,
    location_label: typeof o.location_label === "string" ? o.location_label.trim() || null : null,
    model_count: Math.floor(modelCount),
    about_paragraphs,
  }
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = parseBody(json)
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { supabase } = gate.ctx
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("brands")
    .insert({
      slug: parsed.slug,
      name: parsed.name,
      short_description: parsed.short_description,
      website_url: parsed.website_url,
      logo_url: parsed.logo_url,
      founder_name: parsed.founder_name,
      lead_shaper_name: parsed.lead_shaper_name,
      location_label: parsed.location_label,
      model_count: parsed.model_count,
      about_paragraphs: parsed.about_paragraphs,
      updated_at: now,
    })
    .select("slug")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A brand with this slug already exists" }, { status: 409 })
    }
    console.error("admin brands POST:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePath(BRANDS_BASE)
  revalidatePath(`${BRANDS_BASE}/${data.slug}`)
  return NextResponse.json({ slug: data.slug })
}

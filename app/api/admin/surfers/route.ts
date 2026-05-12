import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { isValidSurferSlug } from "@/lib/surfers/slug"
import { SURFERS_BASE } from "@/lib/surfers/routes"
import { normalizeOptionalHttpUrl } from "@/lib/surfers/social-url"
import { parseSurferQuiverItems } from "@/lib/surfers/parse-surfer-quiver-items"
import type { SurferQuiverItem } from "@/lib/surfers/parse-surfer-quiver-items"

const MAX_SHORT_DESCRIPTION = 2000
const MAX_ABOUT_TOTAL = 20000

function normalizeAbout(input: unknown): string[] | { error: string } {
  if (input === undefined || input === null) return []
  if (!Array.isArray(input)) {
    if (typeof input === "string") {
      const paras = input
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
      if (paras.join("").length > MAX_ABOUT_TOTAL) {
        return { error: "Bio text is too long" }
      }
      return paras
    }
    return { error: "Invalid about_paragraphs" }
  }
  const paras = input
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter(Boolean)
  if (paras.join("").length > MAX_ABOUT_TOTAL) {
    return { error: "Bio text is too long" }
  }
  return paras
}

function parseCreateBody(body: unknown):
  | {
      slug: string
      name: string
      short_description: string | null
      instagram_url: string | null
      youtube_url: string | null
      photo_url: string | null
      location_label: string | null
      about_paragraphs: string[]
      quiver_items: SurferQuiverItem[]
    }
  | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid JSON" }
  const o = body as Record<string, unknown>
  const slug = typeof o.slug === "string" ? o.slug.trim() : ""
  const name = typeof o.name === "string" ? o.name.trim() : ""
  if (!slug || !isValidSurferSlug(slug)) {
    return { error: "Invalid slug (use lowercase letters, numbers, hyphens)" }
  }
  if (!name) return { error: "Name is required" }

  const shortRaw = typeof o.short_description === "string" ? o.short_description.trim() : ""
  if (shortRaw.length > MAX_SHORT_DESCRIPTION) {
    return { error: "Short description is too long" }
  }

  const about = normalizeAbout(o.about_paragraphs ?? o.about_text)
  if ("error" in about) return about

  const rawQuiver = o.quiver_items ?? o.quiver_image_urls
  const quiver = parseSurferQuiverItems(rawQuiver)
  if ("error" in quiver) return quiver

  return {
    slug,
    name,
    short_description: shortRaw || null,
    instagram_url: normalizeOptionalHttpUrl(o.instagram_url),
    youtube_url: normalizeOptionalHttpUrl(o.youtube_url),
    photo_url: typeof o.photo_url === "string" ? o.photo_url.trim() || null : null,
    location_label: typeof o.location_label === "string" ? o.location_label.trim() || null : null,
    about_paragraphs: about,
    quiver_items: quiver,
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

  const parsed = parseCreateBody(json)
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { supabase } = gate.ctx
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("surfers")
    .insert({
      slug: parsed.slug,
      name: parsed.name,
      short_description: parsed.short_description,
      instagram_url: parsed.instagram_url,
      youtube_url: parsed.youtube_url,
      photo_url: parsed.photo_url,
      location_label: parsed.location_label,
      about_paragraphs: parsed.about_paragraphs,
      quiver_items: parsed.quiver_items,
      updated_at: now,
    })
    .select("id, slug")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A surfer with this slug already exists" }, { status: 409 })
    }
    console.error("admin surfers POST:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePath(SURFERS_BASE)
  revalidatePath(`${SURFERS_BASE}/${data.slug}`)
  return NextResponse.json({ slug: data.slug, id: data.id })
}

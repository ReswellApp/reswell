import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { isValidSurferSlug } from "@/lib/surfers/slug"
import { SURFERS_BASE } from "@/lib/surfers/routes"
import { normalizeOptionalHttpUrl } from "@/lib/surfers/social-url"
import { parseSurferQuiverItems } from "@/lib/surfers/parse-surfer-quiver-items"

const MAX_SHORT_DESCRIPTION = 2000
const MAX_ABOUT_TOTAL = 20000

type PatchBody = {
  slug?: string
  name?: string
  short_description?: string | null
  instagram_url?: string | null
  youtube_url?: string | null
  photo_url?: string | null
  location_label?: string | null
  about_paragraphs?: string[]
  about_text?: string
  quiver_items?: unknown
  /** @deprecated use quiver_items */
  quiver_image_urls?: unknown
}

function normalizeAbout(input: unknown): string[] | { error: string } | null {
  if (input === undefined) return null
  if (input === null) return []
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
    return { error: "about_paragraphs must be an array or string" }
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
    if (!s || !isValidSurferSlug(s)) {
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
    const t = typeof body.short_description === "string" ? body.short_description.trim() : ""
    if (t.length > MAX_SHORT_DESCRIPTION) {
      return NextResponse.json({ error: "Short description is too long" }, { status: 400 })
    }
    updates.short_description = t || null
  }
  if (body.instagram_url !== undefined) {
    updates.instagram_url = normalizeOptionalHttpUrl(body.instagram_url)
  }
  if (body.youtube_url !== undefined) {
    updates.youtube_url = normalizeOptionalHttpUrl(body.youtube_url)
  }
  if (body.photo_url !== undefined) {
    updates.photo_url = typeof body.photo_url === "string" ? body.photo_url.trim() || null : null
  }
  if (body.location_label !== undefined) {
    updates.location_label = typeof body.location_label === "string" ? body.location_label.trim() || null : null
  }

  if (body.quiver_items !== undefined || body.quiver_image_urls !== undefined) {
    const raw = body.quiver_items !== undefined ? body.quiver_items : body.quiver_image_urls
    const quiver = parseSurferQuiverItems(raw)
    if ("error" in quiver) {
      return NextResponse.json({ error: quiver.error }, { status: 400 })
    }
    updates.quiver_items = quiver
  }

  if (body.about_paragraphs !== undefined || body.about_text !== undefined) {
    const raw = body.about_paragraphs !== undefined ? body.about_paragraphs : body.about_text
    const paras = normalizeAbout(raw)
    if (paras && "error" in paras) {
      return NextResponse.json({ error: paras.error }, { status: 400 })
    }
    if (Array.isArray(paras)) {
      updates.about_paragraphs = paras
    }
  }

  const { data, error } = await supabase
    .from("surfers")
    .update(updates)
    .eq("slug", currentSlug)
    .select("id, slug")
    .maybeSingle()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 })
    }
    console.error("admin surfers PATCH:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Surfer not found" }, { status: 404 })
  }

  revalidatePath(SURFERS_BASE)
  revalidatePath(`${SURFERS_BASE}/${currentSlug}`)
  revalidatePath(`${SURFERS_BASE}/${data.slug}`)
  return NextResponse.json({ slug: data.slug })
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { slug: paramSlug } = await ctx.params
  const currentSlug = paramSlug.trim()
  if (!currentSlug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 })
  }

  const { supabase } = gate.ctx
  const { data, error } = await supabase.from("surfers").delete().eq("slug", currentSlug).select("slug").maybeSingle()

  if (error) {
    console.error("admin surfers DELETE:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Surfer not found" }, { status: 404 })
  }

  revalidatePath(SURFERS_BASE)
  revalidatePath(`${SURFERS_BASE}/${currentSlug}`)
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { isValidBrandSlug, slugifyBrandName } from "@/lib/brands/slug"
import { BRANDS_BASE } from "@/lib/brands/routes"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, ctx: Ctx) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  let body: { slug?: string }
  try {
    body = (await request.json()) as { slug?: string }
  } catch {
    body = {}
  }

  const slugRaw = typeof body.slug === "string" ? body.slug.trim() : ""
  const { supabase } = gate.ctx

  const { data: row, error: fetchErr } = await supabase
    .from("brand_requests")
    .select(
      "id, requested_name, website_url, short_description, founder_name, lead_shaper_name, location_label, about_paragraphs, logo_url, status",
    )
    .eq("id", id)
    .maybeSingle()

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 })
  }

  if (row.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending requests can be published. This request was already processed." },
      { status: 400 },
    )
  }

  const name = typeof row.requested_name === "string" ? row.requested_name.trim() : ""
  if (!name) {
    return NextResponse.json({ error: "Request has no brand name" }, { status: 400 })
  }

  const slug = slugRaw || slugifyBrandName(name)
  if (!isValidBrandSlug(slug)) {
    return NextResponse.json(
      { error: "Invalid slug (lowercase letters, numbers, hyphens only)" },
      { status: 400 },
    )
  }

  const { data: slugTaken } = await supabase.from("brands").select("id").eq("slug", slug).maybeSingle()
  if (slugTaken) {
    return NextResponse.json({ error: "A brand with this slug already exists" }, { status: 409 })
  }

  const about =
    Array.isArray(row.about_paragraphs) && row.about_paragraphs.length > 0
      ? row.about_paragraphs.filter((p: unknown): p is string => typeof p === "string" && p.trim().length > 0)
      : []

  const now = new Date().toISOString()
  const { error: insertErr } = await supabase.from("brands").insert({
    slug,
    name,
    short_description: row.short_description ?? null,
    website_url: row.website_url ?? null,
    logo_url: row.logo_url ?? null,
    founder_name: row.founder_name ?? null,
    lead_shaper_name: row.lead_shaper_name ?? null,
    location_label: row.location_label ?? null,
    model_count: 0,
    about_paragraphs: about,
    brand_request_id: row.id,
    updated_at: now,
  })

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "Slug or link conflict — brand may already exist." }, { status: 409 })
    }
    console.error("[admin brand-requests publish] insert:", insertErr.message)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  const { data: deletedRows, error: deleteErr } = await supabase
    .from("brand_requests")
    .delete()
    .eq("id", id)
    .eq("status", "pending")
    .select("id")

  if (deleteErr) {
    console.error("[admin brand-requests publish] delete request:", deleteErr.message)
    await supabase.from("brands").delete().eq("slug", slug)
    return NextResponse.json(
      { error: "Brand was created but removing the request failed. Try again (or run the brand_requests admin DELETE migration)." },
      { status: 500 },
    )
  }
  if (!deletedRows?.length) {
    await supabase.from("brands").delete().eq("slug", slug)
    return NextResponse.json(
      { error: "That request was already removed or processed. Nothing was saved." },
      { status: 409 },
    )
  }

  revalidatePath(BRANDS_BASE)
  revalidatePath(`${BRANDS_BASE}/${slug}`)
  return NextResponse.json({ slug, ok: true })
}

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  const { supabase } = gate.ctx
  const { data, error } = await supabase
    .from("brand_requests")
    .select(
      "id, user_id, requested_name, website_url, short_description, founder_name, lead_shaper_name, location_label, about_paragraphs, logo_url, notes, status, created_brand_slug, created_at",
    )
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[admin brand-requests GET]", error.message)
    return NextResponse.json({ error: "Could not load request" }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ request: data })
}

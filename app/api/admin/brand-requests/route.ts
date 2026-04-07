import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { supabase } = gate.ctx
  const { data, error } = await supabase
    .from("brand_requests")
    .select(
      "id, user_id, requested_name, website_url, short_description, founder_name, lead_shaper_name, location_label, about_paragraphs, logo_url, notes, status, created_brand_slug, created_at",
    )
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[admin brand-requests] list:", error.message)
    return NextResponse.json({ error: "Could not load requests" }, { status: 500 })
  }

  return NextResponse.json({ requests: data ?? [] })
}

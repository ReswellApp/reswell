import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminCreatePartnerEmbedBodySchema } from "@/lib/validations/partner-listing-embeds"
import {
  createPartnerEmbedService,
  listPartnerEmbedsForAdminService,
} from "@/lib/services/partnerListingEmbeds"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const result = await listPartnerEmbedsForAdminService(gate.ctx.supabase)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { embeds: result.embeds } }, { status: 200 })
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

  const parsed = adminCreatePartnerEmbedBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await createPartnerEmbedService(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { id: result.id, slug: result.slug } }, { status: 201 })
}

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { revalidateHomePublicCatalog } from "@/lib/cache/revalidate-home-public-catalog"
import { adminHomeHeroListingBodySchema } from "@/lib/validations/home-hero-listings"
import {
  addHomeHeroListingService,
  listHomeHeroListingsForAdminService,
} from "@/lib/services/homeHeroListings"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const result = await listHomeHeroListingsForAdminService(gate.ctx.supabase)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ data: { rows: result.rows } }, { status: 200 })
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

  const parsed = adminHomeHeroListingBodySchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await addHomeHeroListingService(parsed.data.listing_id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  revalidateHomePublicCatalog()
  return NextResponse.json({ data: { id: result.id } }, { status: 201 })
}

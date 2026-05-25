import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { revalidateHomePublicCatalog } from "@/lib/cache/revalidate-home-public-catalog"
import {
  adminHomeRecentSectionListingBodySchema,
  adminHomeRecentSectionParamSchema,
  adminHomeRecentSectionReorderBodySchema,
  homeRecentSectionKeyFromParam,
} from "@/lib/validations/home-recent-section-listings"
import {
  addHomeRecentSectionListingService,
  listHomeRecentSectionListingsForAdminService,
  reorderHomeRecentSectionListingsService,
} from "@/lib/services/homeRecentSectionListings"

export async function GET(_request: Request, ctx: { params: Promise<{ section: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { section: raw } = await ctx.params
  const parsedParam = adminHomeRecentSectionParamSchema.safeParse(raw)
  if (!parsedParam.success) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 })
  }

  const key = homeRecentSectionKeyFromParam(parsedParam.data)
  const result = await listHomeRecentSectionListingsForAdminService(gate.ctx.supabase, key)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { rows: result.rows } }, { status: 200 })
}

export async function POST(request: Request, ctx: { params: Promise<{ section: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { section: raw } = await ctx.params
  const parsedParam = adminHomeRecentSectionParamSchema.safeParse(raw)
  if (!parsedParam.success) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminHomeRecentSectionListingBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const key = homeRecentSectionKeyFromParam(parsedParam.data)
  const result = await addHomeRecentSectionListingService({
    key,
    listingId: parsed.data.listing_id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  revalidateHomePublicCatalog()
  return NextResponse.json({ data: { id: result.id } }, { status: 201 })
}

export async function PATCH(request: Request, ctx: { params: Promise<{ section: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { section: raw } = await ctx.params
  const parsedParam = adminHomeRecentSectionParamSchema.safeParse(raw)
  if (!parsedParam.success) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminHomeRecentSectionReorderBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const key = homeRecentSectionKeyFromParam(parsedParam.data)
  const result = await reorderHomeRecentSectionListingsService(key, parsed.data.ordered_row_ids)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  revalidateHomePublicCatalog()
  return NextResponse.json({ data: { reordered: true } }, { status: 200 })
}

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import {
  adminBoardsBrowseTopPickListingBodySchema,
  adminBoardsBrowseTopPickReorderBodySchema,
} from "@/lib/validations/boards-browse-top-picks"
import {
  addBoardsBrowseTopPickService,
  listBoardsBrowseTopPicksForAdminService,
  reorderBoardsBrowseTopPicksService,
} from "@/lib/services/boardsBrowseTopPicks"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const result = await listBoardsBrowseTopPicksForAdminService(gate.ctx.supabase)
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

  const parsed = adminBoardsBrowseTopPickListingBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await addBoardsBrowseTopPickService({ listingId: parsed.data.listing_id })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  revalidateBoardsBrowseCatalog()
  return NextResponse.json({ data: { id: result.id } }, { status: 201 })
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminBoardsBrowseTopPickReorderBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await reorderBoardsBrowseTopPicksService(parsed.data.ordered_row_ids)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  revalidateBoardsBrowseCatalog()
  return NextResponse.json({ data: { reordered: true } }, { status: 200 })
}

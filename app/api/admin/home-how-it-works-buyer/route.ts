import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  adminHowItWorksBuyerBodySchema,
  adminHowItWorksBuyerDeleteQuerySchema,
} from "@/lib/validations/home-how-it-works-buyer-curation"
import {
  deleteHowItWorksBuyerListingService,
  listHowItWorksBuyerRowsForAdminService,
  upsertHowItWorksBuyerListingService,
} from "@/lib/services/homeHowItWorksBuyerCuration"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const result = await listHowItWorksBuyerRowsForAdminService(gate.ctx.supabase)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { slots: result.rows } }, { status: 200 })
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

  const parsed = adminHowItWorksBuyerBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await upsertHowItWorksBuyerListingService({
    boardType: parsed.data.board_type,
    listingId: parsed.data.listing_id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  revalidatePath("/", "layout")
  revalidatePath("/", "page")
  return NextResponse.json({ data: { updated: true } }, { status: 200 })
}

export async function DELETE(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const sp = request.nextUrl.searchParams
  const parsed = adminHowItWorksBuyerDeleteQuerySchema.safeParse({
    board_type: sp.get("board_type"),
  })
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "board_type required"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await deleteHowItWorksBuyerListingService(parsed.data.board_type)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  revalidatePath("/", "layout")
  revalidatePath("/", "page")
  return NextResponse.json({ data: { deleted: true } }, { status: 200 })
}

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminHowItWorksBuyerSearchQuerySchema } from "@/lib/validations/home-how-it-works-buyer-curation"
import { searchHowItWorksBuyerPickerService } from "@/lib/services/homeHowItWorksBuyerCuration"

export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const sp = request.nextUrl.searchParams
  const parsed = adminHowItWorksBuyerSearchQuerySchema.safeParse({
    board_type: sp.get("board_type"),
    q: sp.get("q") ?? "",
    limit: sp.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid query"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await searchHowItWorksBuyerPickerService(
    gate.ctx.supabase,
    parsed.data.board_type,
    parsed.data.q,
    parsed.data.limit,
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { hits: result.hits } }, { status: 200 })
}

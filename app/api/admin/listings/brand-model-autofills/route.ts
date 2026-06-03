import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { getListingBrandModelAutofillsForAdmin } from "@/lib/services/listingBrandModelAutofillsAdmin"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(2000).optional().default(500),
})

export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  try {
    const result = await getListingBrandModelAutofillsForAdmin(gate.ctx.supabase, {
      limit: parsed.data.limit,
    })
    return NextResponse.json({ data: result }, { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[admin brand-model-autofills] list:", msg)
    return NextResponse.json({ error: "Could not load autofills" }, { status: 500 })
  }
}

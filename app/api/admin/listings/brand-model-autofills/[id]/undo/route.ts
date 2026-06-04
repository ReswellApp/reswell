import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { undoListingBrandModelAutofill } from "@/lib/services/listingBrandModelAutofillsAdmin"

const uuid = z.string().uuid()

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_request: Request, ctx: Ctx) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const parsed = uuid.safeParse(id)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  try {
    const result = await undoListingBrandModelAutofill(gate.ctx.supabase, parsed.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(
      { ok: true, clearedBrand: result.clearedBrand, clearedModel: result.clearedModel },
      { status: 200 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[admin brand-model-autofill undo]:", msg)
    return NextResponse.json({ error: "Could not undo autofill" }, { status: 500 })
  }
}

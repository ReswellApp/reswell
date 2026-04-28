import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  convertUserListingBoardModelDataBodySchema,
  convertUserListingBoardModelDataService,
} from "@/lib/services/userListingBoardModelCatalog"

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = convertUserListingBoardModelDataBodySchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid body"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await convertUserListingBoardModelDataService(gate.ctx.supabase, id, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(
    {
      data: {
        variant_id: result.variantId,
        brand_model_id: result.brandModelId,
      },
    },
    { status: 201 },
  )
}

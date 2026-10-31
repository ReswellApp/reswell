import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { rateAndMaybePromoteDimensionPhotoMatch } from "@/lib/services/surfboardDimensionPhotoMatch"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  rateSurfboardDimensionPhotoMatchSchema,
  surfboardDimensionPhotoMatchIdParamSchema,
} from "@/lib/validations/surfboardDimensionPhoto"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const idParse = surfboardDimensionPhotoMatchIdParamSchema.safeParse(await context.params)
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid match" }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = rateSurfboardDimensionPhotoMatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 })
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    )
  }

  const { data, error } = await rateAndMaybePromoteDimensionPhotoMatch({
    supabase: service,
    matchId: idParse.data.id,
    ratedBy: gate.ctx.user.id,
    matchRating: parsed.data.matchRating,
    photoRating: parsed.data.photoRating,
    dimsRating: parsed.data.dimsRating,
    note: parsed.data.note,
    promoteToRefs: parsed.data.promoteToRefs,
  })

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not save rating" }, { status: 500 })
  }

  return NextResponse.json({ data })
}

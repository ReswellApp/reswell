import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { patchSurfboardDimensionPhotoRef } from "@/lib/db/surfboardDimensionPhoto"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  patchSurfboardDimensionPhotoRefSchema,
  surfboardDimensionPhotoRefIdParamSchema,
} from "@/lib/validations/surfboardDimensionPhoto"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const idParse = surfboardDimensionPhotoRefIdParamSchema.safeParse(await context.params)
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid reference" }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = patchSurfboardDimensionPhotoRefSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid patch" }, { status: 400 })
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

  const { data, error } = await patchSurfboardDimensionPhotoRef(
    service,
    idParse.data.id,
    parsed.data,
  )
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not update reference" }, { status: 500 })
  }

  return NextResponse.json({ data })
}

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { rematchSurfboardDimensionPhotoFailures } from "@/lib/services/surfboardDimensionPhotoMatch"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { rematchSurfboardDimensionPhotoSchema } from "@/lib/validations/surfboardDimensionPhoto"

export const maxDuration = 300

/**
 * POST /api/admin/dimension-photo-match/rematch
 * Re-run vision on Bad/Close matches. Keeps the prior row and inserts a new
 * unrated match with prior_match_id set.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const raw = await request.json().catch(() => ({}))
  const parsed = rematchSurfboardDimensionPhotoSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid rematch request" }, { status: 400 })
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

  const result = await rematchSurfboardDimensionPhotoFailures(service, {
    limit: parsed.data.limit,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      attempted: result.attempted,
      created: result.created,
      skipped: result.skipped,
    },
  })
}

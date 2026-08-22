import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { rateSearchQualityEvent } from "@/lib/db/searchQuality"
import { MARKETPLACE_NL_SEARCH_CACHE_TAG } from "@/lib/services/marketplaceQueryUnderstand"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  rateSearchQualityEventSchema,
  searchQualityEventIdParamSchema,
} from "@/lib/validations/searchQuality"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const idParse = searchQualityEventIdParamSchema.safeParse(await context.params)
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = rateSearchQualityEventSchema.safeParse(raw)
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

  const { data, error } = await rateSearchQualityEvent(
    service,
    idParse.data.id,
    gate.ctx.user.id,
    parsed.data,
  )
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not save rating" }, { status: 500 })
  }

  revalidateTag(MARKETPLACE_NL_SEARCH_CACHE_TAG, "max")
  return NextResponse.json({ data })
}

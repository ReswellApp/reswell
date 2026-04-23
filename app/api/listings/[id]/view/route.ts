import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { recordPublicListingView } from "@/lib/services/listingViews"

const listingIdParamSchema = z.string().uuid("Invalid listing id")

/**
 * Records a public detail-page view (increments listings.views). Optional auth:
 * when logged in, self-views by the listing owner are not counted.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawId } = await context.params
    const idParsed = listingIdParamSchema.safeParse(rawId)
    if (!idParsed.success) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const viewerUserId = user?.id ?? null

    const result = await recordPublicListingView(supabase, {
      listingId: idParsed.data,
      viewerUserId,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    return NextResponse.json({ data: { ok: true } }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { recordKlaviyoCheckoutStarted } from "@/lib/services/klaviyoCheckoutStarted"
import { createClient } from "@/lib/supabase/server"
import { klaviyoCheckoutStartedBodySchema } from "@/lib/validations/klaviyoCheckoutStarted"

/**
 * Client fires on checkout mount so Klaviyo receives **Checkout Started** reliably
 * (server-component fire-and-forget can be dropped before the Events API call completes).
 */
export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = klaviyoCheckoutStartedBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await recordKlaviyoCheckoutStarted(supabase, user, parsed.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      skipped: result.skipped ?? false,
      skipReason: result.skipReason,
    })
  } catch (e) {
    console.error("[klaviyo] checkout-started:", e)
    return NextResponse.json({ error: "Failed to record checkout started" }, { status: 500 })
  }
}

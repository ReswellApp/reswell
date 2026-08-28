import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { recordSellFunnelEvent } from "@/lib/services/sellFunnelEvent"
import { sellFunnelEventSchema } from "@/lib/validations/sell-funnel-event"

/**
 * Best-effort sell-funnel logging. Uses a route handler (not a Server Action)
 * so logging never refreshes `/sell` and aborts an in-flight listing save.
 */
export async function POST(req: NextRequest) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = sellFunnelEventSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid funnel event." }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    await recordSellFunnelEvent(supabase, parsed.data)
    return NextResponse.json({ data: { ok: true } }, { status: 200 })
  } catch (error) {
    console.error(
      "POST /api/sell/funnel:",
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json({ error: "Could not record event." }, { status: 500 })
  }
}

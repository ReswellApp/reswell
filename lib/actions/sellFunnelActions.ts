"use server"

import { createClient } from "@/lib/supabase/server"
import { insertSellFunnelEvent } from "@/lib/db/sellFunnelEvents"
import { sellFunnelEventSchema } from "@/lib/validations/sell-funnel-event"

export type LogSellFunnelEventActionResult = { success: true } | { error: string }

/**
 * Records a sell funnel event (publish attempt / validation failure / upload
 * failure / publish outcome). Best-effort by design: callers should fire and
 * forget — a logging failure must never affect the sell flow itself.
 */
export async function logSellFunnelEventAction(
  raw: unknown,
): Promise<LogSellFunnelEventActionResult> {
  const parsed = sellFunnelEventSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid funnel event." }
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    await insertSellFunnelEvent(supabase, {
      ...parsed.data,
      userId: user?.id ?? null,
    })
    return { success: true }
  } catch (error) {
    console.error(
      "logSellFunnelEventAction:",
      error instanceof Error ? error.message : error,
    )
    return { error: "Could not record event." }
  }
}

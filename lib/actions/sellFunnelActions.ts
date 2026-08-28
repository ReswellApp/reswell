"use server"

import { createClient } from "@/lib/supabase/server"
import { recordSellFunnelEvent } from "@/lib/services/sellFunnelEvent"
import { sellFunnelEventSchema } from "@/lib/validations/sell-funnel-event"

export type LogSellFunnelEventActionResult = { success: true } | { error: string }

/**
 * Records a sell funnel event. Prefer {@link logSellFunnelEvent} (route POST)
 * from client components so logging does not refresh the sell page mid-save.
 */
export async function logSellFunnelEventAction(
  raw: unknown,
): Promise<LogSellFunnelEventActionResult> {
  const parsed = sellFunnelEventSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid funnel event." }

  try {
    const supabase = await createClient()
    await recordSellFunnelEvent(supabase, parsed.data)
    return { success: true }
  } catch (error) {
    console.error(
      "logSellFunnelEventAction:",
      error instanceof Error ? error.message : error,
    )
    return { error: "Could not record event." }
  }
}

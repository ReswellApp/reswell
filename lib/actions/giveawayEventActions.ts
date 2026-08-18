"use server"

import { createClient } from "@/lib/supabase/server"
import { recordGiveawayEvent } from "@/lib/services/giveawayEntry"
import { giveawayEventBodySchema } from "@/lib/validations/giveaway-event"

export type LogGiveawayEventActionResult = { success: true } | { error: string }

/** Fire-and-forget giveaway CTA / brand click. Never block the UI on failure. */
export async function logGiveawayEventAction(
  raw: unknown,
): Promise<LogGiveawayEventActionResult> {
  const parsed = giveawayEventBodySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid giveaway event." }
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const result = await recordGiveawayEvent(supabase, {
      slug: parsed.data.slug,
      event: parsed.data.event,
      surface: parsed.data.surface,
      preferredBrand: parsed.data.preferredBrand,
      userId: user?.id ?? null,
    })
    if (!result.ok) return { error: result.error }
    return { success: true }
  } catch (error) {
    console.error(
      "logGiveawayEventAction:",
      error instanceof Error ? error.message : error,
    )
    return { error: "Could not record event." }
  }
}

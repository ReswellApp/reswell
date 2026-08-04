"use server"

import { createClient } from "@/lib/supabase/server"
import { insertBrowseButtonClick } from "@/lib/db/browseButtonClicks"
import { browseButtonClickSchema } from "@/lib/validations/browse-button-click"

export type LogBrowseButtonClickActionResult = { success: true } | { error: string }

/**
 * Records a browse page button click (Ship to me / Filter). Best-effort by
 * design: callers should fire and forget — a logging failure must never affect
 * browse UX.
 */
export async function logBrowseButtonClickAction(
  raw: unknown,
): Promise<LogBrowseButtonClickActionResult> {
  const parsed = browseButtonClickSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid browse button event." }
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    await insertBrowseButtonClick(supabase, {
      ...parsed.data,
      userId: user?.id ?? null,
    })
    return { success: true }
  } catch (error) {
    console.error(
      "logBrowseButtonClickAction:",
      error instanceof Error ? error.message : error,
    )
    return { error: "Could not record event." }
  }
}

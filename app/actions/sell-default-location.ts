"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { updateProfileDefaultListingLocality } from "@/lib/db/profileDefaultListingLocality"
import { createClient } from "@/lib/supabase/server"

const saveDefaultListingLocationSchema = z.object({
  city: z.string().trim().min(1).max(200),
  state: z.string().trim().max(80).optional(),
})

/**
 * Called after a successful live listing publish. Saves locality only (no street)
 * to the member profile for /sell prefill. Ignored for impersonation (caller must not invoke).
 */
export async function saveDefaultListingLocationAction(raw: unknown) {
  const parsed = saveDefaultListingLocationSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid location" as const }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" as const }
  }

  const stateTrimmed = (parsed.data.state ?? "").trim()
  const { error } = await updateProfileDefaultListingLocality(supabase, user.id, {
    city: parsed.data.city.trim(),
    state: stateTrimmed ? stateTrimmed : null,
  })

  if (error) {
    return { error: error as string }
  }

  revalidatePath("/sell")
  return { success: true as const }
}

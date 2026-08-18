"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { updateProfileDefaultListingLocality } from "@/lib/db/profileDefaultListingLocality"
import { createClient } from "@/lib/supabase/server"

const saveDefaultListingLocationSchema = z.object({
  city: z.string().trim().min(1).max(200),
  state: z.string().trim().max(80).optional(),
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
  display: z.string().trim().max(300).optional(),
})

/**
 * Saves locality (+ optional map pin) to the member profile for /sell reuse.
 * Call after the seller confirms a listing area. Ignored for impersonation
 * (caller must not invoke).
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
    lat: parsed.data.lat ?? null,
    lng: parsed.data.lng ?? null,
    display: parsed.data.display?.trim() || null,
  })

  if (error) {
    return { error: error as string }
  }

  revalidatePath("/sell")
  revalidatePath("/sell/boards")
  return { success: true as const }
}

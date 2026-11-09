"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { resolveManagedProfileWriter } from "@/lib/account-access/managed-seller"
import { validateDisplayName } from "@/lib/display-name-validation"

const updateOperatingProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(50),
  location: z.string().trim().max(200).nullable(),
  city: z.string().trim().max(120).nullable(),
  bio: z.string().trim().max(2000).nullable(),
})

export type UpdateOperatingProfileResult = { success: true } | { error: string }

function emptyToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

/** Saves the shop name, location, and bio for the account currently being operated. */
export async function updateOperatingProfileAction(
  raw: unknown,
): Promise<UpdateOperatingProfileResult> {
  const parsed = updateOperatingProfileSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the profile and try again." }
  }

  const nameCheck = validateDisplayName(parsed.data.displayName)
  if (!nameCheck.valid) return { error: nameCheck.error }

  const writer = await resolveManagedProfileWriter("profile.manage")
  if (!writer.ok) return { error: writer.error }

  const { error } = await writer.supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName.trim(),
      location: emptyToNull(parsed.data.location),
      city: emptyToNull(parsed.data.city),
      bio: emptyToNull(parsed.data.bio),
      updated_at: new Date().toISOString(),
    })
    .eq("id", writer.userId)

  if (error) {
    console.error("[shop-profile] update failed", {
      userId: writer.userId,
      message: error.message,
      timestamp: new Date().toISOString(),
    })
    return { error: "Failed to update profile" }
  }

  revalidatePath("/dashboard/profile")
  return { success: true }
}

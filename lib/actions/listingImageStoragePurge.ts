"use server"

import { z } from "zod"

import { purgeListingImageStorageForRowIds } from "@/lib/services/listingImageStoragePurge"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

const purgeSchema = z.object({
  listingId: z.string().uuid(),
  imageRowIds: z.array(z.string().uuid()).min(1),
})

export async function purgeListingImageStorageAction(raw: unknown) {
  const parsed = purgeSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid request" as const }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" as const }
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return { error: "Server misconfigured" as const }
  }

  const result = await purgeListingImageStorageForRowIds(
    supabase,
    service,
    user.id,
    parsed.data.listingId,
    parsed.data.imageRowIds,
  )
  if (!result.ok) {
    return { error: result.error }
  }
  return { success: true as const }
}

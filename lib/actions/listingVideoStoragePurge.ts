"use server"

import { z } from "zod"

import { purgeListingVideoStorageForRowIds } from "@/lib/services/listingVideoStoragePurge"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

const purgeSchema = z.object({
  listingId: z.string().uuid(),
  videoRowIds: z.array(z.string().uuid()).min(1),
})

export async function purgeListingVideoStorageAction(raw: unknown) {
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

  const result = await purgeListingVideoStorageForRowIds(
    supabase,
    service,
    user.id,
    parsed.data.listingId,
    parsed.data.videoRowIds,
  )
  if (!result.ok) {
    return { error: result.error }
  }
  return { success: true as const }
}

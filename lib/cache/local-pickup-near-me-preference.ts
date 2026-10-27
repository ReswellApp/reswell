import { unstable_cache } from "next/cache"
import { cache } from "react"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  getLocalPickupNearMePreferenceForUser,
  type LocalPickupNearMePreference,
} from "@/lib/db/localPickupNearMePreference"

/** Bump when serialized preference shape or loader semantics change. */
export const LOCAL_PICKUP_NEAR_ME_PREF_CACHE_KEY = "local-pickup-near-me-pref-v1"

export function localPickupNearMePreferenceTag(userId: string): string {
  return `${LOCAL_PICKUP_NEAR_ME_PREF_CACHE_KEY}:${userId}`
}

const DISABLED_PREF: LocalPickupNearMePreference = {
  enabled: false,
  location: "",
  lat: null,
  lng: null,
  radiusMi: null,
}

async function loadLocalPickupNearMePreferenceFromDb(
  userId: string,
): Promise<LocalPickupNearMePreference> {
  const id = userId.trim()
  if (!id) return DISABLED_PREF

  try {
    const supabase = createServiceRoleClient()
    return await getLocalPickupNearMePreferenceForUser(supabase, id)
  } catch (error) {
    console.error("[localPickupNearMePreference] cached load failed:", error)
    return DISABLED_PREF
  }
}

/**
 * Cross-request cache for browse merge + profile reads. Tag-invalidated on save
 * so browse does not hit Postgres on every /boards request for the same user.
 */
export async function getCachedLocalPickupNearMePreferenceForUser(
  userId: string,
): Promise<LocalPickupNearMePreference> {
  const id = userId.trim()
  if (!id) return DISABLED_PREF

  if (process.env.NODE_ENV === "development") {
    return loadLocalPickupNearMePreferenceFromDb(id)
  }

  const loader = unstable_cache(
    async (): Promise<LocalPickupNearMePreference> => loadLocalPickupNearMePreferenceFromDb(id),
    [LOCAL_PICKUP_NEAR_ME_PREF_CACHE_KEY, id],
    {
      tags: [localPickupNearMePreferenceTag(id)],
      revalidate: 60 * 60 * 24,
    },
  )

  return loader()
}

/** Dedupes preference reads within one RSC request (browse page + layouts). */
export const getLocalPickupNearMePreferenceForBrowse = cache(
  async (userId: string | null | undefined): Promise<LocalPickupNearMePreference | null> => {
    if (!userId?.trim()) return null
    return getCachedLocalPickupNearMePreferenceForUser(userId)
  },
)

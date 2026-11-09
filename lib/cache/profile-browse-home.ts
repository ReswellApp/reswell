import { unstable_cache } from "next/cache"
import { cache } from "react"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  getProfileBrowseHomeForUser,
  type ProfileBrowseHome,
} from "@/lib/db/profileBrowseHome"

export const PROFILE_BROWSE_HOME_CACHE_KEY = "profile-browse-home-v1"

export function profileBrowseHomeTag(userId: string): string {
  return `${PROFILE_BROWSE_HOME_CACHE_KEY}:${userId}`
}

const EMPTY: ProfileBrowseHome = {
  applyOnBoards: false,
  localPickupOnly: false,
  location: "",
  lat: null,
  lng: null,
  radiusMi: null,
}

async function loadProfileBrowseHomeFromDb(userId: string): Promise<ProfileBrowseHome> {
  const id = userId.trim()
  if (!id) return EMPTY

  try {
    const supabase = createServiceRoleClient()
    return await getProfileBrowseHomeForUser(supabase, id)
  } catch (error) {
    console.error("[profileBrowseHome] cached load failed:", error)
    return EMPTY
  }
}

export async function getCachedProfileBrowseHomeForUser(
  userId: string,
): Promise<ProfileBrowseHome> {
  const id = userId.trim()
  if (!id) return EMPTY

  if (process.env.NODE_ENV === "development") {
    return loadProfileBrowseHomeFromDb(id)
  }

  const loader = unstable_cache(
    async (): Promise<ProfileBrowseHome> => loadProfileBrowseHomeFromDb(id),
    [PROFILE_BROWSE_HOME_CACHE_KEY, id],
    {
      tags: [profileBrowseHomeTag(id)],
      revalidate: 60 * 60 * 24,
    },
  )

  return loader()
}

export const getProfileBrowseHomeForBrowse = cache(
  async (userId: string | null | undefined): Promise<ProfileBrowseHome | null> => {
    if (!userId?.trim()) return null
    return getCachedProfileBrowseHomeForUser(userId)
  },
)

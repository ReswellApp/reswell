import { unstable_cache } from "next/cache"
import { getTopCitiesDirectory } from "@/lib/services/topCitiesDirectory"
import type { TopCitiesDirectory } from "@/lib/types/top-cities-directory"
import { createServiceRoleClient } from "@/lib/supabase/server"

/** Hourly cache for the public `/cities/top` directory. */
export const TOP_CITIES_DIRECTORY_CACHE_TAG = "top-cities-directory"
export const TOP_CITIES_DIRECTORY_REVALIDATE_SECONDS = 60 * 60

const getCachedTopCitiesDirectoryPayload = unstable_cache(
  async (): Promise<TopCitiesDirectory> => {
    const supabase = createServiceRoleClient()
    return getTopCitiesDirectory(supabase)
  },
  ["top-cities-directory-v1"],
  {
    revalidate: TOP_CITIES_DIRECTORY_REVALIDATE_SECONDS,
    tags: [TOP_CITIES_DIRECTORY_CACHE_TAG],
  },
)

export function getCachedTopCitiesDirectory(): Promise<TopCitiesDirectory> {
  if (process.env.NODE_ENV === "development") {
    const supabase = createServiceRoleClient()
    return getTopCitiesDirectory(supabase)
  }
  return getCachedTopCitiesDirectoryPayload()
}

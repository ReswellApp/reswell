import { unstable_cache } from "next/cache"
import { loadAdminHomePulse, type AdminHomePulse } from "@/lib/services/adminHomePulse"

export const ADMIN_HOME_PULSE_CACHE_TAG = "admin-home-pulse"
export const ADMIN_HOME_PULSE_REVALIDATE_SECONDS = 60

const getCachedAdminHomePulseLoader = unstable_cache(
  loadAdminHomePulse,
  ["admin-home-pulse"],
  {
    revalidate: ADMIN_HOME_PULSE_REVALIDATE_SECONDS,
    tags: [ADMIN_HOME_PULSE_CACHE_TAG],
  },
)

export async function getCachedAdminHomePulse(): Promise<
  { ok: true; data: AdminHomePulse } | { ok: false; error: string }
> {
  return getCachedAdminHomePulseLoader()
}

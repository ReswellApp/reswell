import {
  dbGetAdminUserDetailProfile,
  dbListAdminUserDetailListings,
  type AdminUserDetailListingRow,
  type AdminUserDetailProfileRow,
} from "@/lib/db/adminUserDetail"
import { createServiceRoleClient } from "@/lib/supabase/server"

export type AdminUserDetail = {
  profile: AdminUserDetailProfileRow
  listings: AdminUserDetailListingRow[]
}

function getServiceOrThrow(): ReturnType<typeof createServiceRoleClient> | null {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

export async function getAdminUserDetail(userId: string): Promise<
  | { ok: true; data: AdminUserDetail }
  | { ok: false; message: string; status: number }
> {
  const supabase = getServiceOrThrow()
  if (!supabase) {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const profileResult = await dbGetAdminUserDetailProfile(supabase, userId)
  if (!profileResult.ok) {
    return { ok: false, message: profileResult.message, status: profileResult.status }
  }

  const listingsResult = await dbListAdminUserDetailListings(supabase, userId)
  if (!listingsResult.ok) {
    return { ok: false, message: listingsResult.message, status: 500 }
  }

  return {
    ok: true,
    data: {
      profile: profileResult.profile,
      listings: listingsResult.listings,
    },
  }
}

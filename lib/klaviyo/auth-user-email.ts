import { createServiceRoleClient } from "@/lib/supabase/server"

/** Resolves Auth email for Klaviyo profile merge (service role). */
export async function getAuthEmailForUserId(userId: string): Promise<string | null> {
  try {
    const admin = createServiceRoleClient()
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error || !data?.user?.email) return null
    return data.user.email
  } catch {
    return null
  }
}

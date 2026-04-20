import { createServiceRoleClient } from "@/lib/supabase/server"

/** Resolves Auth email for Klaviyo profile merge (service role). */
export async function getAuthEmailForUserId(userId: string): Promise<string | null> {
  try {
    const admin = createServiceRoleClient()
    const { data, error } = await admin.auth.admin.getUserById(userId)
    const authEmail = data?.user?.email?.trim()
    if (!error && authEmail) return authEmail

    const { data: profile } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle()
    const profileEmail = typeof profile?.email === "string" ? profile.email.trim() : ""
    return profileEmail || null
  } catch {
    return null
  }
}

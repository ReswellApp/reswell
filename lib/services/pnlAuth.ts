import { createClient } from "@/lib/supabase/server"

export type PnlServiceError = { error: string }

/** Ensures the caller is staff (admin or employee) and returns their user id. */
export async function requireStaffUserId(): Promise<{ userId: string } | PnlServiceError> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in required" }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (error || (!profile?.is_admin && !profile?.is_employee)) {
    return { error: "Forbidden" }
  }
  return { userId: user.id }
}

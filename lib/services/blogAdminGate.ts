import { createClient } from "@/lib/supabase/server"

/** Only marketplace admins (`profiles.is_admin`) may see the `/blog` floating CMS — not employee-only roles. */
export async function resolveBlogAdminAccess(): Promise<{ canManageBlogCms: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { canManageBlogCms: false }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  return { canManageBlogCms: profile?.is_admin === true }
}

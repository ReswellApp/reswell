import { createClient } from "@/lib/supabase/server"

/**
 * Authorize integration admin routes via Bearer secret or admin session cookie.
 */
export async function authorizeGoogleMerchantAdmin(
  request: Request,
  secretEnvKey: "GOOGLE_MERCHANT_SETUP_SECRET" | "CRON_SECRET" | "SEARCH_REINDEX_SECRET",
): Promise<boolean> {
  const secret = process.env[secretEnvKey]?.trim()
  const auth = request.headers.get("authorization") || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (secret && token === secret) return true

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  return profile?.is_admin === true
}

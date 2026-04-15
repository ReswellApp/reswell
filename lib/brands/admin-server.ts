import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient, User } from "@supabase/supabase-js"

export type AdminContext = {
  supabase: SupabaseClient
  user: User
}

export type AdminStaffContext = {
  supabase: SupabaseClient
  user: User
  /** True when `profiles.is_admin` — not granted to employees-only accounts. */
  isAdmin: boolean
}

/**
 * Admins and support employees may read shared admin resources (e.g. order lookup).
 * Destructive actions should still use {@link requireAdmin}.
 */
export async function requireAdminOrEmployee(): Promise<
  { ok: true; ctx: AdminStaffContext } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) }
  }
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    console.error("requireAdminOrEmployee profile:", error.message)
    return { ok: false, response: NextResponse.json({ error: "Could not verify access" }, { status: 500 }) }
  }
  if (!profile?.is_admin && !profile?.is_employee) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true, ctx: { supabase, user, isAdmin: profile.is_admin === true } }
}

/**
 * Use in Route Handlers that must only run for marketplace admins (`profiles.is_admin`).
 */
export async function requireAdmin():
  Promise<{ ok: true; ctx: AdminContext } | { ok: false; response: NextResponse }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) }
  }
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    console.error("requireAdmin profile:", error.message)
    return { ok: false, response: NextResponse.json({ error: "Could not verify access" }, { status: 500 }) }
  }
  if (!profile?.is_admin) {
    return { ok: false, response: NextResponse.json({ error: "Admin only" }, { status: 403 }) }
  }
  return { ok: true, ctx: { supabase, user } }
}
